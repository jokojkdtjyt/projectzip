import { Router, type Request, type Response } from "express";
import { clerkClient } from "@clerk/express";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { sendWelcomeEmail } from "../lib/email";

const router: Router = Router();

// ── POST /users/welcome ────────────────────────────────────────────────────────
// Called from the frontend once after a user completes sign-up.
// Idempotent: calling it multiple times for the same user just sends multiple
// emails, but the frontend only fires it once per user (tracked in localStorage).
router.post(
  "/users/welcome",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;

    try {
      const user = await clerkClient.users.getUser(userId);
      const email =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
      const firstName = user.firstName || "there";

      if (!email) {
        res.status(400).json({ error: "User has no email address" });
        return;
      }

      await sendWelcomeEmail(email, firstName);

      res.json({ ok: true });
    } catch (err) {
      console.error("[Users] Failed to send welcome email:", err);
      res.status(500).json({ error: "Failed to send welcome email" });
    }
  },
);

export default router;
