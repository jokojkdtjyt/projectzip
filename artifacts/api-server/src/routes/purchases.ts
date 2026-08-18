import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { db, cartTable, purchasedTable, pendingPurchasesTable, modulesTable, notificationsTable, disputesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { clerkClient } from "@clerk/express";
import { eq, and, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import {
  sendPurchaseApprovedEmail,
  sendPurchaseRejectedEmail,
} from "../lib/email";

/** 1 minute for testing — change to 6 * 3600 * 1000 for production */
const REMIND_COOLDOWN_MS = 60 * 1_000;

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;

// ── Startup env-var check ─────────────────────────────────────────────────────
if (!BOT_TOKEN) {
  console.warn("[Telegram] TELEGRAM_BOT_TOKEN is not set — Telegram notifications disabled.");
}
if (!CHAT_ID) {
  console.warn("[Telegram] TELEGRAM_CHAT_ID is not set — receipt notifications will be skipped. Set this secret to enable Telegram messages.");
}

// ── Register Telegram webhook on startup ──────────────────────────────────────
if (BOT_TOKEN && DEV_DOMAIN) {
  const webhookUrl = `https://${DEV_DOMAIN}/api/purchases/telegram-webhook`;
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  })
    .then((r) => r.json())
    .then((j) => console.log("[Telegram] Webhook registered:", JSON.stringify(j)))
    .catch((e) => console.error("[Telegram] Webhook registration failed:", e));
}

type TierKey = "3month" | "1year" | "lifetime";

function tierLabel(tier: TierKey | string): string {
  if (tier === "3month") return "3-Month";
  if (tier === "1year") return "1-Year";
  return "Lifetime";
}

function computeExpiresAt(tier: TierKey | string): Date | null {
  const now = new Date();
  if (tier === "3month") {
    return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  }
  if (tier === "1year") {
    return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  }
  return null; // lifetime — no expiry
}

// ── POST /purchases/submit ────────────────────────────────────────────────────
router.post(
  "/purchases/submit",
  requireAuth,
  upload.single("receipt") as ReturnType<typeof upload.single>,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;

    if (!req.file) {
      res.status(400).json({ error: "Receipt image is required" });
      return;
    }

    // 1. Parse tier selections: JSON map of { moduleId -> tier }
    let tiersMap: Record<string, string> = {};
    try {
      const tiersRaw = (req.body as Record<string, string>).tiers;
      if (tiersRaw) tiersMap = JSON.parse(tiersRaw) as Record<string, string>;
    } catch {
      // If not provided, default all to lifetime
    }

    // 2. Get cart items
    const cartRows = await db
      .select()
      .from(cartTable)
      .where(eq(cartTable.userId, userId));

    if (cartRows.length === 0) {
      res.status(400).json({ error: "Cart is empty" });
      return;
    }

    const moduleIds = cartRows.map((r) => r.moduleId);

    // 3. Fetch module data
    const allModules = await db.select().from(modulesTable);
    const moduleMap = new Map(allModules.map((m) => [m.id, m]));

    // 4. Resolve tier + tierPrice per module
    const moduleTiers = moduleIds.map((moduleId) => {
      const mod = moduleMap.get(moduleId);
      const tier = (tiersMap[moduleId] as TierKey) || "lifetime";
      let tierPrice: number | null = null;
      if (mod) {
        if (tier === "3month") tierPrice = mod.price3Month ?? null;
        else if (tier === "1year") tierPrice = mod.price1Year ?? null;
        else tierPrice = mod.priceLifetime ?? mod.price ?? null;
      }
      return { moduleId, tier, tierPrice };
    });

    // 5. Get user info from Clerk
    const user = await clerkClient.users.getUser(userId);
    const name =
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unknown";
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "Unknown";

    // 6. Session ID groups all modules in this checkout
    const sessionId = crypto.randomUUID();

    // 7. Send photo + inline buttons to Telegram
    let telegramMessageId: number | null = null;
    let telegramFileId = "";

    const totalAmount = moduleTiers.reduce((s, t) => s + (t.tierPrice ?? 0), 0);

    if (BOT_TOKEN && CHAT_ID) {
      const caption = [
        `<b>🎓 New Purchase Request</b>`,
        ``,
        `<b>Student:</b> ${escapeHtml(name)}`,
        `<b>Email:</b> ${escapeHtml(email)}`,
        `<b>Modules:</b>`,
        ...moduleTiers.map(({ moduleId, tier, tierPrice }) => {
          const title = moduleMap.get(moduleId)?.title ?? moduleId;
          const priceStr = tierPrice != null ? `${tierPrice.toLocaleString()} DZD` : "?";
          return `  • ${escapeHtml(title)} (${tierLabel(tier)} — ${priceStr})`;
        }),
        ``,
        `<b>Total:</b> ${totalAmount.toLocaleString()} DZD`,
        ``,
        `<code>session: ${sessionId}</code>`,
      ].join("\n");

      const replyMarkup = JSON.stringify({
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve:${sessionId}` },
            { text: "❌ Reject", callback_data: `reject:${sessionId}` },
          ],
        ],
      });

      // Build FormData once — reused across retries
      const formData = new FormData();
      formData.append("chat_id", CHAT_ID);
      formData.append("caption", caption);
      formData.append("parse_mode", "HTML");
      formData.append("reply_markup", replyMarkup);
      formData.append(
        "photo",
        new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }),
        req.file.originalname || "receipt.jpg"
      );

      // Retry loop for transient network errors (ECONNRESET, etc.)
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 1_000;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const tgRes = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
            { method: "POST", body: formData }
          );
          const tgJson = (await tgRes.json()) as {
            ok: boolean;
            result?: {
              message_id: number;
              photo?: Array<{ file_id: string }>;
            };
          };
          if (tgJson.ok && tgJson.result) {
            telegramMessageId = tgJson.result.message_id;
            telegramFileId = tgJson.result.photo?.at(-1)?.file_id ?? "";
            break; // success — exit retry loop
          } else {
            console.error(`[Telegram] sendPhoto attempt ${attempt} not ok:`, JSON.stringify(tgJson));
          }
        } catch (err) {
          console.error(`[Telegram] sendPhoto attempt ${attempt} failed:`, err);
        }

        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      // If all retries exhausted and we still don't have a message id, abort the request
      if (!telegramMessageId) {
        console.error("[Telegram] All sendPhoto retries exhausted — aborting purchase submission.");
        res.status(502).json({ error: "Failed to send receipt to admin. Please try again." });
        return;
      }
    }

    // 8. Insert one pending_purchase row per module (with tier + tierPrice)
    await db.insert(pendingPurchasesTable).values(
      moduleTiers.map(({ moduleId, tier, tierPrice }) => ({
        id: crypto.randomUUID(),
        userId,
        moduleId,
        imageUrl: telegramFileId || "pending",
        status: "pending" as const,
        sessionId,
        tier,
        tierPrice: tierPrice ?? undefined,
        ...(telegramMessageId != null ? { telegramMessageId } : {}),
      }))
    );

    // 9. Clear the user's cart
    await db.delete(cartTable).where(eq(cartTable.userId, userId));

    res.json({ ok: true, sessionId });
  }
);

// ── GET /purchases/pending ────────────────────────────────────────────────────
router.get(
  "/purchases/pending",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;

    const rows = await db
      .select()
      .from(pendingPurchasesTable)
      .where(
        and(
          eq(pendingPurchasesTable.userId, userId),
          eq(pendingPurchasesTable.status, "pending"),
        ),
      );

    type SessionGroup = {
      sessionId: string;
      moduleIds: string[];
      lastRemindedAt: string | null;
      createdAt: string;
    };
    const sessions = new Map<string, SessionGroup>();
    for (const row of rows) {
      if (!sessions.has(row.sessionId)) {
        sessions.set(row.sessionId, {
          sessionId: row.sessionId,
          moduleIds: [],
          lastRemindedAt: row.lastRemindedAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        });
      }
      sessions.get(row.sessionId)!.moduleIds.push(row.moduleId);
    }

    res.json([...sessions.values()]);
  },
);

// ── GET /purchases/rejected ───────────────────────────────────────────────────
router.get(
  "/purchases/rejected",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;

    // Get module IDs from rejected pending_purchases that have no active purchased entry
    const rejectedRows = await db
      .select()
      .from(pendingPurchasesTable)
      .where(
        and(
          eq(pendingPurchasesTable.userId, userId),
          eq(pendingPurchasesTable.status, "rejected"),
        ),
      );

    // Also get any active disputes for this user
    const activeDisputes = await db
      .select()
      .from(disputesTable)
      .where(
        and(
          eq(disputesTable.userId, userId),
          eq(disputesTable.status, "pending"),
        ),
      );

    const disputedModuleIds = new Set(activeDisputes.map((d) => d.moduleId));

    // Only include modules that aren't purchased and don't already have a pending dispute
    const purchasedRows = await db
      .select()
      .from(purchasedTable)
      .where(eq(purchasedTable.userId, userId));
    const purchasedModuleIds = new Set(purchasedRows.map((r) => r.moduleId));

    const rejectedModuleIds = [
      ...new Set(
        rejectedRows
          .filter((r) => !purchasedModuleIds.has(r.moduleId) && !disputedModuleIds.has(r.moduleId))
          .map((r) => r.moduleId),
      ),
    ];

    res.json(rejectedModuleIds);
  },
);

// ── POST /purchases/disputes/submit ────────────────────────────────────────────
router.post(
  "/purchases/disputes/submit",
  requireAuth,
  upload.single("receipt") as ReturnType<typeof upload.single>,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { moduleId, message } = req.body as { moduleId?: string; message?: string };

    if (!moduleId || !message?.trim()) {
      res.status(400).json({ error: "moduleId and message are required" });
      return;
    }

    // Check the user actually had a rejected purchase for this module
    const [rejected] = await db
      .select()
      .from(pendingPurchasesTable)
      .where(
        and(
          eq(pendingPurchasesTable.userId, userId),
          eq(pendingPurchasesTable.moduleId, moduleId),
          eq(pendingPurchasesTable.status, "rejected"),
        ),
      )
      .limit(1);

    if (!rejected) {
      res.status(400).json({ error: "No rejected purchase found for this module" });
      return;
    }

    // Fetch module info
    const allModules = await db.select().from(modulesTable);
    const moduleMap = new Map(allModules.map((m) => [m.id, m]));
    const mod = moduleMap.get(moduleId);
    const moduleTitle = mod?.title ?? moduleId;

    // Get user info
    const user = await clerkClient.users.getUser(userId);
    const name =
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unknown";
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "Unknown";

    const disputeId = crypto.randomUUID();
    let telegramMessageId: number | null = null;
    let telegramFileId: string | null = null;

    // Send to Telegram
    if (BOT_TOKEN && CHAT_ID) {
      const caption = [
        `<b>⚠️ Support Request</b>`,
        ``,
        `<b>Student:</b> ${escapeHtml(name)}`,
        `<b>Email:</b> ${escapeHtml(email)}`,
        `<b>Module:</b> ${escapeHtml(moduleTitle)}`,
        ``,
        `<b>Message:</b>`,
        escapeHtml(message.trim()),
        ``,
        `<code>dispute: ${disputeId}</code>`,
      ].join("\n");

      const replyMarkup = JSON.stringify({
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `dispute_approve:${disputeId}` },
            { text: "❌ Reject", callback_data: `dispute_reject:${disputeId}` },
          ],
        ],
      });

      if (req.file) {
        // Send photo with caption
        const formData = new FormData();
        formData.append("chat_id", CHAT_ID);
        formData.append("caption", caption);
        formData.append("parse_mode", "HTML");
        formData.append("reply_markup", replyMarkup);
        formData.append(
          "photo",
          new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }),
          req.file.originalname || "dispute.jpg",
        );

        try {
          const tgRes = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
            { method: "POST", body: formData },
          );
          const tgJson = (await tgRes.json()) as {
            ok: boolean;
            result?: {
              message_id: number;
              photo?: Array<{ file_id: string }>;
            };
          };
          if (tgJson.ok && tgJson.result) {
            telegramMessageId = tgJson.result.message_id;
            telegramFileId = tgJson.result.photo?.at(-1)?.file_id ?? null;
          } else {
            console.error("[Telegram] dispute sendPhoto not ok:", JSON.stringify(tgJson));
          }
        } catch (err) {
          console.error("[Telegram] dispute sendPhoto failed:", err);
        }
      } else {
        // No image — send as text message
        try {
          const tgRes = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: CHAT_ID,
                text: caption,
                parse_mode: "HTML",
                reply_markup: replyMarkup,
              }),
            },
          );
          const tgJson = (await tgRes.json()) as {
            ok: boolean;
            result?: { message_id: number };
          };
          if (tgJson.ok && tgJson.result) {
            telegramMessageId = tgJson.result.message_id;
          } else {
            console.error("[Telegram] dispute sendMessage not ok:", JSON.stringify(tgJson));
          }
        } catch (err) {
          console.error("[Telegram] dispute sendMessage failed:", err);
        }
      }
    }

    // Insert dispute record
    const now = new Date();
    await db.insert(disputesTable).values({
      id: disputeId,
      userId,
      moduleId,
      message: message.trim(),
      imageUrl: telegramFileId,
      status: "pending",
      createdAt: now,
      ...(telegramMessageId != null ? { telegramMessageId } : {}),
    });

    res.json({ ok: true, disputeId, createdAt: now.toISOString() });
  },
);

// ── POST /purchases/disputes/remind/:disputeId ────────────────────────────────
router.post(
  "/purchases/disputes/remind/:disputeId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { disputeId } = req.params as { disputeId: string };

    const [dispute] = await db
      .select()
      .from(disputesTable)
      .where(
        and(
          eq(disputesTable.id, disputeId),
          eq(disputesTable.userId, userId),
          eq(disputesTable.status, "pending"),
        ),
      )
      .limit(1);

    if (!dispute) {
      res.status(404).json({ error: "Dispute not found or no longer pending" });
      return;
    }

    const now = new Date();
    const lastReminded = dispute.lastRemindedAt;

    if (lastReminded && now.getTime() - lastReminded.getTime() < REMIND_COOLDOWN_MS) {
      const remainingMs = REMIND_COOLDOWN_MS - (now.getTime() - lastReminded.getTime());
      res.status(429).json({ error: "Too soon to remind", remainingMs });
      return;
    }

    const createdAt = dispute.createdAt;
    if (!lastReminded && now.getTime() - createdAt.getTime() < REMIND_COOLDOWN_MS) {
      const remainingMs = REMIND_COOLDOWN_MS - (now.getTime() - createdAt.getTime());
      res.status(429).json({ error: "Too soon to remind", remainingMs });
      return;
    }

    // Fetch module info
    const allModules = await db.select().from(modulesTable);
    const moduleMap = new Map(allModules.map((m) => [m.id, m]));
    const moduleTitle = moduleMap.get(dispute.moduleId)?.title ?? dispute.moduleId;

    const user = await clerkClient.users.getUser(userId);
    const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unknown";
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "Unknown";

    if (BOT_TOKEN && CHAT_ID) {
      const caption = [
        `<b>🔔 Reminder: Support Request</b>`,
        ``,
        `<b>Student:</b> ${escapeHtml(name)}`,
        `<b>Email:</b> ${escapeHtml(email)}`,
        `<b>Module:</b> ${escapeHtml(moduleTitle)}`,
        ``,
        `<b>Message:</b>`,
        escapeHtml(dispute.message),
        ``,
        `<code>dispute: ${disputeId}</code>`,
      ].join("\n");

      const replyMarkup = JSON.stringify({
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `dispute_approve:${disputeId}` },
            { text: "❌ Reject", callback_data: `dispute_reject:${disputeId}` },
          ],
        ],
      });

      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: CHAT_ID,
              text: caption,
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            }),
          },
        );
        const tgJson = (await tgRes.json()) as { ok: boolean };
        if (!tgJson.ok) {
          console.error("[Telegram] dispute remind sendMessage not ok:", JSON.stringify(tgJson));
        }
      } catch (err) {
        console.error("[Telegram] dispute remind sendMessage failed:", err);
      }
    }

    await db
      .update(disputesTable)
      .set({ lastRemindedAt: now })
      .where(eq(disputesTable.id, disputeId));

    res.json({ ok: true });
  },
);

// ── POST /purchases/remind/:sessionId ─────────────────────────────────────────
router.post(
  "/purchases/remind/:sessionId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { sessionId } = req.params as { sessionId: string };

    const pending = await db
      .select()
      .from(pendingPurchasesTable)
      .where(
        and(
          eq(pendingPurchasesTable.sessionId, sessionId),
          eq(pendingPurchasesTable.userId, userId),
          eq(pendingPurchasesTable.status, "pending"),
        ),
      );

    if (pending.length === 0) {
      res.status(404).json({ error: "Session not found or no longer pending" });
      return;
    }

    const firstRow = pending[0];
    const now = new Date();
    const lastReminded = firstRow.lastRemindedAt;

    if (lastReminded && now.getTime() - lastReminded.getTime() < REMIND_COOLDOWN_MS) {
      const remainingMs = REMIND_COOLDOWN_MS - (now.getTime() - lastReminded.getTime());
      res.status(429).json({ error: "Too soon to remind", remainingMs });
      return;
    }

    const createdAt = firstRow.createdAt;
    if (!lastReminded && now.getTime() - createdAt.getTime() < REMIND_COOLDOWN_MS) {
      const remainingMs = REMIND_COOLDOWN_MS - (now.getTime() - createdAt.getTime());
      res.status(429).json({ error: "Too soon to remind", remainingMs });
      return;
    }

    // Fetch module names
    const allModules = await db.select().from(modulesTable);
    const moduleMap = new Map(allModules.map((m) => [m.id, m]));
    const moduleIds = pending.map((p) => p.moduleId);
    const moduleNames = moduleIds.map((id) => moduleMap.get(id)?.title ?? id);

    const user = await clerkClient.users.getUser(userId);
    const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unknown";
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "Unknown";

    if (BOT_TOKEN && CHAT_ID) {
      const caption = [
        `<b>🔔 Reminder: Pending Purchase Request</b>`,
        ``,
        `<b>Student:</b> ${escapeHtml(name)}`,
        `<b>Email:</b> ${escapeHtml(email)}`,
        `<b>Modules:</b>`,
        ...pending.map(({ moduleId, tier, tierPrice }) => {
          const title = moduleMap.get(moduleId)?.title ?? moduleId;
          const priceStr = tierPrice != null ? `${tierPrice.toLocaleString()} DZD` : "?";
          return `  • ${escapeHtml(title)} (${tierLabel(tier)} — ${priceStr})`;
        }),
        ``,
        `<code>session: ${sessionId}</code>`,
      ].join("\n");

      const replyMarkup = JSON.stringify({
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve:${sessionId}` },
            { text: "❌ Reject", callback_data: `reject:${sessionId}` },
          ],
        ],
      });

      const imageFileId = firstRow.imageUrl;

      if (imageFileId && imageFileId !== "pending") {
        try {
          const tgRes = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: CHAT_ID,
                photo: imageFileId,
                caption,
                parse_mode: "HTML",
                reply_markup: replyMarkup,
              }),
            },
          );
          const tgJson = (await tgRes.json()) as { ok: boolean };
          if (!tgJson.ok) {
            console.error("[Telegram] remind sendPhoto not ok:", JSON.stringify(tgJson));
          }
        } catch (err) {
          console.error("[Telegram] remind sendPhoto failed:", err);
        }
      }
    }

    await db
      .update(pendingPurchasesTable)
      .set({ lastRemindedAt: now })
      .where(eq(pendingPurchasesTable.sessionId, sessionId));

    res.json({ ok: true });
  },
);

// ── POST /purchases/telegram-webhook ──────────────────────────────────────────
router.post(
  "/purchases/telegram-webhook",
  async (req: Request, res: Response): Promise<void> => {
    res.json({ ok: true });

    if (!BOT_TOKEN) return;

    const body = req.body as {
      callback_query?: {
        id: string;
        data: string;
        message?: { message_id: number; chat: { id: number } };
      };
    };

    const cq = body?.callback_query;
    if (!cq) return;

    const colonIdx = cq.data.indexOf(":");
    if (colonIdx === -1) return;
    const action = cq.data.slice(0, colonIdx);
    const entityId = cq.data.slice(colonIdx + 1);
    if (!entityId || action === "noop") return;

    const msgId = cq.message?.message_id;
    const chatId = cq.message?.chat?.id;

    // ── Dispute actions ──────────────────────────────────────────────────
    if (action === "dispute_approve") {
      const [dispute] = await db
        .select()
        .from(disputesTable)
        .where(eq(disputesTable.id, entityId))
        .limit(1);

      if (dispute && dispute.status === "pending") {
        const { userId, moduleId } = dispute;

        // Grant access — insert into purchased (using the same tier info from the rejected purchase)
        const [rejected] = await db
          .select()
          .from(pendingPurchasesTable)
          .where(
            and(
              eq(pendingPurchasesTable.userId, userId),
              eq(pendingPurchasesTable.moduleId, moduleId),
              eq(pendingPurchasesTable.status, "rejected"),
            ),
          )
          .limit(1);

        const tier = rejected?.tier ?? "lifetime";

        await db
          .insert(purchasedTable)
          .values({
            userId,
            moduleId,
            tier,
            expiresAt: computeExpiresAt(tier),
          })
          .onConflictDoNothing();

        await db
          .update(disputesTable)
          .set({ status: "approved" })
          .where(eq(disputesTable.id, entityId));

        // Notify the student
        const allModules = await db.select().from(modulesTable);
        const moduleMap = new Map(allModules.map((m) => [m.id, m]));
        const moduleTitle = moduleMap.get(moduleId)?.title ?? moduleId;
        await db.insert(notificationsTable).values({
          id: crypto.randomUUID(),
          userId,
          type: "purchase_approved",
          title: "Dispute Resolved — Access Granted 🎉",
          body: `Your access to ${moduleTitle} has been granted after review.`,
          moduleId,
        });

        // Send email
        const [user] = await Promise.all([
          clerkClient.users.getUser(userId).catch(() => null),
        ]);
        if (user) {
          const email =
            user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
              ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
          if (email) {
            sendPurchaseApprovedEmail(email, [moduleTitle]).catch((err) =>
              console.error("[Email] dispute_approve email failed:", err),
            );
          }
        }
      }

      await tgAnswer(cq.id, "✅ Dispute approved — access granted!");
      if (chatId && msgId) await tgEditMarkup(chatId, msgId, "✅ APPROVED");
      res.json({ ok: true });
      return;
    }

    if (action === "dispute_reject") {
      await db
        .update(disputesTable)
        .set({ status: "rejected" })
        .where(eq(disputesTable.id, entityId));

      const [dispute] = await db
        .select()
        .from(disputesTable)
        .where(eq(disputesTable.id, entityId))
        .limit(1);

      if (dispute) {
        const allModules = await db.select().from(modulesTable);
        const moduleMap = new Map(allModules.map((m) => [m.id, m]));
        const moduleTitle = moduleMap.get(dispute.moduleId)?.title ?? dispute.moduleId;
        await db.insert(notificationsTable).values({
          id: crypto.randomUUID(),
          userId: dispute.userId,
          type: "purchase_rejected",
          title: "Support Request Denied",
          body: `Your support request for ${moduleTitle} was not approved. Please contact support for more information.`,
          moduleId: dispute.moduleId,
        });

        // Send email
        const [user] = await Promise.all([
          clerkClient.users.getUser(dispute.userId).catch(() => null),
        ]);
        if (user) {
          const email =
            user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
              ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
          if (email) {
            sendPurchaseRejectedEmail(email, moduleTitle, true).catch((err) =>
              console.error("[Email] dispute_reject email failed:", err),
            );
          }
        }
      }

      await tgAnswer(cq.id, "❌ Dispute rejected");
      if (chatId && msgId) await tgEditMarkup(chatId, msgId, "❌ REJECTED");
      res.json({ ok: true });
      return;
    }

    // ── Existing purchase actions ─────────────────────────────────────────
    // (msgId and chatId from lines above are reused here)

    if (action === "approve") {
      const pending = await db
        .select()
        .from(pendingPurchasesTable)
        .where(
          and(
            eq(pendingPurchasesTable.sessionId, entityId),
            eq(pendingPurchasesTable.status, "pending")
          )
        );

      if (pending.length > 0) {
        const { userId } = pending[0];
        const moduleIds = pending.map((p) => p.moduleId);

        // Insert purchased rows with tier + computed expiresAt
        await db
          .insert(purchasedTable)
          .values(
            pending.map((p) => ({
              userId,
              moduleId: p.moduleId,
              tier: p.tier,
              expiresAt: computeExpiresAt(p.tier),
            }))
          )
          .onConflictDoNothing();

        await db
          .update(pendingPurchasesTable)
          .set({ status: "approved" })
          .where(eq(pendingPurchasesTable.sessionId, entityId));

        // Notify the student
        const allModules = await db.select().from(modulesTable);
        const moduleMap = new Map(allModules.map((m) => [m.id, m]));
        const moduleNames = moduleIds.map((id) => moduleMap.get(id)?.title ?? id);
        await db.insert(notificationsTable).values({
          id: crypto.randomUUID(),
          userId,
          type: "purchase_approved",
          title: "Purchase Approved! 🎉",
          body: moduleNames.length === 1
            ? `${moduleNames[0]} is now unlocked.`
            : `${moduleNames.slice(0, -1).join(", ")} and ${moduleNames.at(-1)} are now unlocked.`,
          moduleId: moduleIds[0] ?? null,
        });

        // Send email
        const [user] = await Promise.all([
          clerkClient.users.getUser(userId).catch(() => null),
        ]);
        if (user) {
          const email =
            user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
              ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
          if (email) {
            sendPurchaseApprovedEmail(email, moduleNames).catch((err) =>
              console.error("[Email] approve email failed:", err),
            );
          }
        }
      }

      await tgAnswer(cq.id, "✅ Purchase approved!");
      if (chatId && msgId) await tgEditMarkup(chatId, msgId, "✅ APPROVED");
    } else if (action === "reject") {
      const pendingRows = await db
        .select()
        .from(pendingPurchasesTable)
        .where(eq(pendingPurchasesTable.sessionId, entityId));

      await db
        .update(pendingPurchasesTable)
        .set({ status: "rejected" })
        .where(eq(pendingPurchasesTable.sessionId, entityId));

      if (pendingRows.length > 0) {
        const userId = pendingRows[0].userId;
        const allModules = await db.select().from(modulesTable);
        const moduleMap = new Map(allModules.map((m) => [m.id, m]));
        const moduleNames = [...new Set(pendingRows.map((p) => moduleMap.get(p.moduleId)?.title ?? p.moduleId))];

        // Send email for each unique module
        const [user] = await Promise.all([
          clerkClient.users.getUser(userId).catch(() => null),
        ]);
        if (user) {
          const email =
            user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
              ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
          if (email) {
            for (const name of moduleNames) {
              sendPurchaseRejectedEmail(email, name, false).catch((err) =>
                console.error("[Email] reject email failed:", err),
              );
            }
          }
        }
      }

      await tgAnswer(cq.id, "❌ Purchase rejected");
      if (chatId && msgId) await tgEditMarkup(chatId, msgId, "❌ REJECTED");
    }
  }
);

// ── GET /admin/purchases ───────────────────────────────────────────────────────
router.get(
  "/admin/purchases",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    const rows = await db
      .select()
      .from(pendingPurchasesTable)
      .orderBy(pendingPurchasesTable.createdAt);

    const allModules = await db.select().from(modulesTable);
    const moduleMap = new Map(allModules.map((m) => [m.id, m]));

    type Group = {
      sessionId: string;
      userId: string;
      imageUrl: string;
      status: string;
      createdAt: string;
      modules: string[];
      telegramMessageId: number | null;
    };
    const groups = new Map<string, Group>();

    for (const row of rows) {
      if (!groups.has(row.sessionId)) {
        groups.set(row.sessionId, {
          sessionId: row.sessionId,
          userId: row.userId,
          imageUrl: row.imageUrl,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          modules: [],
          telegramMessageId: row.telegramMessageId ?? null,
        });
      }
      const g = groups.get(row.sessionId)!;
      const title = moduleMap.get(row.moduleId)?.title ?? row.moduleId;
      const priceStr = row.tierPrice != null ? ` (${tierLabel(row.tier)} — ${row.tierPrice.toLocaleString()} DZD)` : "";
      g.modules.push(`${title}${priceStr}`);
      if (row.status === "pending") g.status = "pending";
      else if (row.status === "approved" && g.status === "rejected")
        g.status = "approved";
    }

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const resolved = await Promise.allSettled(
      userIds.map(async (uid) => {
        const u = await clerkClient.users.getUser(uid);
        const em =
          u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
            ?.emailAddress ?? "";
        return {
          id: uid,
          name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || em,
          email: em,
        };
      })
    );
    const userMap = new Map(
      resolved
        .filter(
          (r): r is PromiseFulfilledResult<{ id: string; name: string; email: string }> =>
            r.status === "fulfilled"
        )
        .map((r) => [r.value.id, r.value])
    );

    const result = [...groups.values()].map((g) => ({
      ...g,
      studentName: userMap.get(g.userId)?.name ?? "Unknown",
      studentEmail: userMap.get(g.userId)?.email ?? "",
    }));

    result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(result);
  }
);

// ── GET /admin/purchases/receipt/:sessionId ────────────────────────────────────
router.get(
  "/admin/purchases/receipt/:sessionId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params as { sessionId: string };

    const [row] = await db
      .select()
      .from(pendingPurchasesTable)
      .where(eq(pendingPurchasesTable.sessionId, sessionId))
      .limit(1);

    if (!row || !row.imageUrl || row.imageUrl === "pending" || !BOT_TOKEN) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }

    try {
      const r = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${row.imageUrl}`
      );
      const j = (await r.json()) as { ok: boolean; result?: { file_path: string } };
      if (!j.ok || !j.result?.file_path) {
        res.status(404).json({ error: "Could not retrieve file" });
        return;
      }
      res.redirect(
        `https://api.telegram.org/file/bot${BOT_TOKEN}/${j.result.file_path}`
      );
    } catch {
      res.status(500).json({ error: "Failed to fetch receipt" });
    }
  }
);

// ── POST /admin/purchases/:sessionId/approve ────────────────────────────────────
router.post(
  "/admin/purchases/:sessionId/approve",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params as { sessionId: string };

    const pending = await db
      .select()
      .from(pendingPurchasesTable)
      .where(
        and(
          eq(pendingPurchasesTable.sessionId, sessionId),
          eq(pendingPurchasesTable.status, "pending"),
        ),
      );

    if (pending.length === 0) {
      res.status(404).json({ error: "No pending purchases found for this session" });
      return;
    }

    const { userId } = pending[0];
    const moduleIds = pending.map((p) => p.moduleId);

    // Insert purchased rows with tier + computed expiresAt
    await db
      .insert(purchasedTable)
      .values(
        pending.map((p) => ({
          userId,
          moduleId: p.moduleId,
          tier: p.tier,
          expiresAt: computeExpiresAt(p.tier),
        })),
      )
      .onConflictDoNothing();

    await db
      .update(pendingPurchasesTable)
      .set({ status: "approved" })
      .where(eq(pendingPurchasesTable.sessionId, sessionId));

    // Notify the student
    const allModules = await db.select().from(modulesTable);
    const moduleMap = new Map(allModules.map((m) => [m.id, m]));
    const moduleNames = moduleIds.map((id) => moduleMap.get(id)?.title ?? id);
    await db.insert(notificationsTable).values({
      id: crypto.randomUUID(),
      userId,
      type: "purchase_approved",
      title: "Purchase Approved! 🎉",
      body:
        moduleNames.length === 1
          ? `${moduleNames[0]} is now unlocked.`
          : `${moduleNames.slice(0, -1).join(", ")} and ${moduleNames.at(-1)} are now unlocked.`,
      moduleId: moduleIds[0] ?? null,
    });

    // Update Telegram message if it exists
    const firstRow = pending[0];
    if (BOT_TOKEN && firstRow.telegramMessageId) {
      const chatRows = await db
        .select()
        .from(pendingPurchasesTable)
        .where(eq(pendingPurchasesTable.sessionId, sessionId))
        .limit(1);
      const chatIdFromDb = chatRows[0]?.telegramMessageId;
      // We don't store chat_id in the DB — just try the notification channel
      // The Telegram message already has its buttons; this is best-effort
    }

    res.json({ ok: true, modules: moduleNames });
  },
);

// ── POST /admin/purchases/:sessionId/reject ──────────────────────────────────────
router.post(
  "/admin/purchases/:sessionId/reject",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params as { sessionId: string };

    const [row] = await db
      .select()
      .from(pendingPurchasesTable)
      .where(eq(pendingPurchasesTable.sessionId, sessionId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await db
      .update(pendingPurchasesTable)
      .set({ status: "rejected" })
      .where(eq(pendingPurchasesTable.sessionId, sessionId));

    if (row.status === "pending") {
      await db.insert(notificationsTable).values({
        id: crypto.randomUUID(),
        userId: row.userId,
        type: "purchase_rejected",
        title: "Purchase Rejected",
        body: "Your payment receipt was not approved. Please contact support if you have questions.",
        moduleId: row.moduleId,
      });
    }

    res.json({ ok: true });
  },
);

// ── Helpers ────────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function tgAnswer(callbackQueryId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function tgEditMarkup(
  chatId: number,
  messageId: number,
  label: string
): Promise<void> {
  await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [[{ text: label, callback_data: "noop" }]],
        },
      }),
    }
  );
}

export default router;
