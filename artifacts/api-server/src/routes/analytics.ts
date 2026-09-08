import { Router, type IRouter } from "express";
import { createSign } from "node:crypto";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  classifyAnalyticsError,
  mapAnalyticsReports,
  runReport,
  type AnalyticsResponse,
} from "./analytics-report";

const router: IRouter = Router();
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REPORT_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const CACHE_TTL_MS = 5 * 60 * 1000;

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

let cachedReport: { expiresAt: number; data: unknown } | null = null;

function base64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function readConfig(): { propertyId: string; serviceAccount: ServiceAccount } | null {
  const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID?.trim();
  const rawCredentials = process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON;
  if (!propertyId || !rawCredentials) return null;

  const parsed = JSON.parse(rawCredentials) as Partial<ServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Google Analytics service-account JSON is missing required fields");
  }

  return {
    propertyId: propertyId.replace(/^properties\//, ""),
    serviceAccount: {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    },
  };
}

async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: REPORT_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const signature = signer
    .sign(serviceAccount.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? `Google token request failed (${response.status})`);
  }
  return body.access_token;
}

router.get("/admin/analytics", requireAdmin, async (_req, res): Promise<void> => {
  let config: ReturnType<typeof readConfig>;
  try {
    config = readConfig();
  } catch (error) {
    res.status(500).json({
      configured: false,
      error: error instanceof Error ? error.message : "Invalid Google Analytics configuration",
    });
    return;
  }

  if (!config) {
    res.json({ configured: false });
    return;
  }

  if (cachedReport && cachedReport.expiresAt > Date.now()) {
    res.json(cachedReport.data);
    return;
  }

  try {
    const accessToken = await getAccessToken(config.serviceAccount);
    const dateRange = { startDate: "28daysAgo", endDate: "today" };
    const summaryReport = await runReport(config.propertyId, accessToken, {
      dateRanges: [dateRange],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagementRate" },
      ],
    });
    const trendReport = await runReport(config.propertyId, accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    });
    const pagesReport = await runReport(config.propertyId, accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews", desc: true } }],
      limit: "5",
    });

    const data = mapAnalyticsReports(summaryReport, trendReport, pagesReport);
    cachedReport = { expiresAt: Date.now() + CACHE_TTL_MS, data };
    res.json(data);
  } catch (error) {
    console.error("[Google Analytics] Report failed:", error);
    res.status(502).json({
      configured: true,
      errorCode: classifyAnalyticsError(error),
      error: error instanceof Error ? error.message : "Google Analytics report failed",
    });
  }
});

export default router;