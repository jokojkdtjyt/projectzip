import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.warn("[Email] RESEND_API_KEY not set — emails disabled.");
}

// Using Resend's default test sender until the domain is verified.
// Swap to "PreClinik <notifications@preclinik.com>" once the domain is set up.
const FROM = "PreClinik <onboarding@resend.dev>";
const BASE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "https://preclinik.com";

// ── Brand colours ──────────────────────────────────────────────────────────
const COLORS = {
  bg: "#0f0f13",
  card: "#1a1a24",
  border: "#2a2a3a",
  accent: "#dc2626",   // red-600
  accentHover: "#b91c1c",
  text: "#f1f1f6",
  textMuted: "#9ca3af",
  textDark: "#6b7280",
};

/** Shared wrapper around every PreClinik email. */
function htmlLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:${COLORS.card};border-radius:12px;border:1px solid ${COLORS.border};overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:24px;font-weight:700;color:${COLORS.accent};">PreClinik</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px 32px 32px;font-size:15px;line-height:1.6;color:${COLORS.text};">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 24px;font-size:13px;color:${COLORS.textDark};">
              <hr style="border:none;border-top:1px solid ${COLORS.border};margin-bottom:16px;" />
              &copy; ${new Date().getFullYear()} PreClinik — Medical Exam Preparation
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Email send helper ──────────────────────────────────────────────────────

type EmailPayload = {
  to: string;
  subject: string;
  title: string;
  bodyHtml: string;
};

async function sendEmail({ to, subject, title, bodyHtml }: EmailPayload): Promise<void> {
  if (!resend) {
    console.warn(`[Email] Skipping "${subject}" to ${to} — Resend not configured.`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: htmlLayout(title, bodyHtml),
  });

  if (error) {
    console.error(`[Email] Failed to send "${subject}" to ${to}:`, error);
  }
}

// ── Template: Purchase Approved ─────────────────────────────────────────────

export async function sendPurchaseApprovedEmail(
  userEmail: string,
  moduleNames: string[],
): Promise<void> {
  const list = moduleNames
    .map((n) => `<li style="margin-bottom:4px;">${n}</li>`)
    .join("");

  await sendEmail({
    to: userEmail,
    subject: "Your PreClinik access is unlocked! ✅",
    title: "Purchase Approved",
    bodyHtml: `
      <p style="margin:0 0 16px;">Great news — your purchase has been approved! You now have full access to:</p>
      <ul style="margin:0 0 20px;padding-left:20px;">${list}</ul>
      <p style="margin:0 0 24px;">Start studying right away by logging into your account.</p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="border-radius:8px;background-color:${COLORS.accent};padding:12px 28px;">
            <a href="${BASE_URL}" style="color:#fff;text-decoration:none;font-size:15px;font-weight:600;display:block;">
              Go to PreClinik →
            </a>
          </td>
        </tr>
      </table>
    `,
  });
}

// ── Template: Purchase Rejected / Needs Attention ──────────────────────────

export async function sendPurchaseRejectedEmail(
  userEmail: string,
  moduleName: string,
  isDispute: boolean,
): Promise<void> {
  const subject = isDispute
    ? "Support Request Update — PreClinik"
    : "Purchase Needs Attention — PreClinik";

  const explanation = isDispute
    ? `Your support request for <strong>${moduleName}</strong> was not approved.`
    : `Your purchase request for <strong>${moduleName}</strong> was not approved.`;

  await sendEmail({
    to: userEmail,
    subject,
    title: "Action Needed",
    bodyHtml: `
      <p style="margin:0 0 16px;">${explanation}</p>
      <p style="margin:0 0 16px;">If you believe this was a mistake, you can submit a support request from your account with additional details and our team will review it.</p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="border-radius:8px;background-color:${COLORS.accent};padding:12px 28px;">
            <a href="${BASE_URL}/dispute?module=${encodeURIComponent(moduleName)}" style="color:#fff;text-decoration:none;font-size:15px;font-weight:600;display:block;">
              Contact Support →
            </a>
          </td>
        </tr>
      </table>
    `,
  });
}

// ── Template: Welcome Email ────────────────────────────────────────────────

export async function sendWelcomeEmail(
  userEmail: string,
  firstName: string,
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: "Welcome to PreClinik! 🎓",
    title: "Welcome Aboard",
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;">Welcome to <strong>PreClinik</strong> — your medical exam preparation platform.</p>
      <p style="margin:0 0 16px;">Here's what you can do right now:</p>
      <ul style="margin:0 0 20px;padding-left:20px;">
        <li style="margin-bottom:6px;">Browse our module library and start learning</li>
        <li style="margin-bottom:6px;">Track your progress across lessons and quizzes</li>
        <li style="margin-bottom:6px;">Unlock premium content with a purchase</li>
      </ul>
      <p style="margin:0 0 24px;">Ready to get started?</p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="border-radius:8px;background-color:${COLORS.accent};padding:12px 28px;">
            <a href="${BASE_URL}" style="color:#fff;text-decoration:none;font-size:15px;font-weight:600;display:block;">
              Start Learning →
            </a>
          </td>
        </tr>
      </table>
    `,
  });
}
