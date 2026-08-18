/**
 * Bunny Stream integration routes
 *
 * POST /admin/lessons/:lessonId/upload-video
 *   — Requires admin. Accepts multipart `video` field.
 *   — Creates the video in Bunny, uploads the binary, saves bunnyVideoId to DB.
 *
 * GET /modules/:moduleId/lessons/:lessonId/play-url
 *   — Requires any signed-in user who owns the module (or is an admin).
 *   — Returns a signed Bunny embed URL valid for 1 hour.
 *
 * Token signing:
 *   SHA-256(BUNNY_API_KEY + videoId + expiresUnixTimestamp)
 *   — matches Bunny Stream's Token Authentication scheme (enable in Library › Security).
 */

import { Router, type IRouter } from "express";
import https from "node:https";
import crypto from "node:crypto";
import { db, lessonsTable, purchasedTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { requireAdmin } from "../middlewares/requireAdmin";
import { isAdminRequest } from "../lib/isAdminRequest";

const BUNNY_LIBRARY_ID = "706977";
const BUNNY_API_BASE = "https://video.bunnycdn.com";

function getBunnyKey(): string {
  const key = process.env.BUNNY_API_KEY;
  if (!key) throw new Error("BUNNY_API_KEY environment variable is not set");
  return key;
}

const router: IRouter = Router();

// ── POST /admin/lessons/:lessonId/upload-video ────────────────────────────────
//
// Accepts a raw binary body (Content-Type: application/octet-stream) instead
// of multipart/form-data. This lets us pipe the incoming stream directly to
// Bunny — zero RAM buffering, no size limit, no proxy timeout risk from
// double-hop latency.
//
// The browser XHR in uploadManager.ts sends `file` (a File object) as the
// body directly, which is semantically equivalent to a raw binary body.
router.post(
  "/admin/lessons/:lessonId/upload-video",
  requireAdmin,
  async (req, res): Promise<void> => {
    const lessonId = req.params.lessonId as string;

    // 1. Verify lesson exists before starting the upload
    const [lesson] = await db
      .select()
      .from(lessonsTable)
      .where(eq(lessonsTable.id, lessonId));

    if (!lesson) {
      req.resume(); // drain body so socket stays clean
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    const BUNNY_API_KEY = getBunnyKey();

    // 2. Create video entry in Bunny Stream library
    const createRes = await fetch(
      `${BUNNY_API_BASE}/library/${BUNNY_LIBRARY_ID}/videos`,
      {
        method: "POST",
        headers: {
          AccessKey: BUNNY_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: lesson.title }),
      },
    );

    if (!createRes.ok) {
      req.resume();
      const text = await createRes.text();
      console.error("[bunny] create failed:", createRes.status, text);
      res.status(502).json({ error: `Bunny create video failed: ${text}` });
      return;
    }

    const { guid: videoId } = (await createRes.json()) as { guid: string };
    console.log(`[bunny] created video ${videoId} for lesson ${lessonId}, piping upload…`);

    // 3. Pipe the raw request body directly to Bunny — no RAM buffering.
    //    Content-Length forwarded so Bunny knows when the stream ends.
    const contentLength = req.headers["content-length"];

    await new Promise<void>((resolve, reject) => {
      const bunnyReq = https.request(
        {
          hostname: "video.bunnycdn.com",
          path: `/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`,
          method: "PUT",
          headers: {
            AccessKey: BUNNY_API_KEY,
            "Content-Type": "application/octet-stream",
            ...(contentLength ? { "Content-Length": contentLength } : {}),
          },
        },
        (bunnyRes) => {
          const ok =
            bunnyRes.statusCode !== undefined &&
            bunnyRes.statusCode >= 200 &&
            bunnyRes.statusCode < 300;
          bunnyRes.resume(); // consume Bunny's response body
          if (ok) {
            resolve();
          } else {
            // Best-effort delete the dangling Bunny entry
            fetch(
              `${BUNNY_API_BASE}/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`,
              { method: "DELETE", headers: { AccessKey: BUNNY_API_KEY } },
            ).catch(() => {});
            reject(
              new Error(`Bunny upload failed with status ${bunnyRes.statusCode}`),
            );
          }
        },
      );

      bunnyReq.on("error", reject);
      req.pipe(bunnyReq);
    });

    console.log(`[bunny] upload complete for video ${videoId}`);

    // 4. Persist bunnyVideoId to the lesson record
    const [updated] = await db
      .update(lessonsTable)
      .set({ bunnyVideoId: videoId })
      .where(eq(lessonsTable.id, lessonId))
      .returning();

    res.json({ bunnyVideoId: videoId, lesson: updated });
  },
);

// ── GET /modules/:moduleId/lessons/:lessonId/play-url ─────────────────────────
router.get(
  "/modules/:moduleId/lessons/:lessonId/play-url",
  async (req, res): Promise<void> => {
    // Must be signed in
    const auth = getAuth(req);
    if (!auth?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const moduleId = req.params.moduleId as string;
    const lessonId = req.params.lessonId as string;

    // Fetch lesson (always by exact id — published check comes after)
    const [lesson] = await db
      .select()
      .from(lessonsTable)
      .where(
        and(eq(lessonsTable.id, lessonId), eq(lessonsTable.moduleId, moduleId)),
      );

    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    if (!lesson.bunnyVideoId) {
      res.status(404).json({ error: "No video uploaded for this lesson yet" });
      return;
    }

    // Single admin check — also respects X-Preview-As-Student header so an
    // admin in student-preview mode is treated exactly like a real student.
    const adminAccess = await isAdminRequest(req);

    // Draft lessons are invisible to students (and admins in student-preview)
    if (!lesson.published && !adminAccess) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    // Ownership: admins and free lessons pass unconditionally;
    // students need a non-expired purchase record for paid lessons.
    let hasAccess = adminAccess || lesson.isFree;
    if (!hasAccess) {
      const [purchase] = await db
        .select()
        .from(purchasedTable)
        .where(
          and(
            eq(purchasedTable.userId, auth.userId),
            eq(purchasedTable.moduleId, moduleId),
          ),
        );
      if (!purchase) {
        // No purchase at all
        res.status(403).json({ error: "You do not own this module" });
        return;
      }
      if (purchase.expiresAt && purchase.expiresAt <= new Date()) {
        // Timed access has expired — 410 so client can show "renew" prompt
        res.status(410).json({ error: "Access expired" });
        return;
      }
      hasAccess = true;
    }

    if (!hasAccess) {
      res.status(403).json({ error: "You do not own this module" });
      return;
    }

    // Build signed embed URL — 1-hour expiry.
    // Include a per-user identifier so Bunny scopes resume-position tracking
    // to the individual viewer, not the browser session.  We hash the Clerk
    // userId for privacy (Bunny never sees internal IDs).
    const BUNNY_API_KEY = getBunnyKey();
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const token = crypto
      .createHash("sha256")
      .update(BUNNY_API_KEY + lesson.bunnyVideoId + expires)
      .digest("hex");

    const bunnyScopedUserId = crypto
      .createHash("sha256")
      .update(auth.userId)
      .digest("hex")
      .substring(0, 32);

    const embedUrl = `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${lesson.bunnyVideoId}?token=${token}&expires=${expires}&autoplay=false&responsive=true&userId=${bunnyScopedUserId}`;

    res.json({ embedUrl, videoId: lesson.bunnyVideoId });
  },
);

export default router;
