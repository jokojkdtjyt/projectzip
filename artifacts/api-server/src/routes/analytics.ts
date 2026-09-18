import { Router, type IRouter } from "express";
import { createSign } from "node:crypto";
import { db, lessonsTable, modulesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  buildContentReportRequest,
  classifyAnalyticsError,
  buildTopPagesReportRequest,
  mapContentReport,
  mapAnalyticsReports,
  mapRealtimeReport,
  runReport,
  runRealtimeReport,
  type AnalyticsResponse,
  type ContentAnalyticsData,
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

  let parsed: Partial<ServiceAccount>;
  try {
    parsed = JSON.parse(rawCredentials) as Partial<ServiceAccount>;
  } catch {
    throw new Error("Invalid Google Analytics service-account JSON credentials");
  }
  if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") {
    throw new Error("Google Analytics service-account JSON is missing required fields");
  }

  const normalizedPropertyId = propertyId.replace(/^properties\//, "");
  if (!/^\d+$/.test(normalizedPropertyId)) {
    throw new Error("Invalid Google Analytics Property ID");
  }

  return {
    propertyId: normalizedPropertyId,
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
  let signature: string;
  try {
    signature = signer
      .sign(serviceAccount.private_key, "base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch {
    throw new Error("Invalid Google Analytics service-account credentials");
  }
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

    const errorCode = classifyAnalyticsError(error);

    const errorCode = classifyAnalyticsError(error);
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
    const pagesReport = await runReport(
      config.propertyId,
      accessToken,
      buildTopPagesReportRequest(dateRange),
    );

    let content: ContentAnalyticsData = {
      topModules: [],
      topLessons: [],
    };
    let contentError: string | undefined;
    try {
      const contentReport = await runReport(
        config.propertyId,
        accessToken,
        buildContentReportRequest(dateRange),
      );
      const [modules, lessons] = await Promise.all([
        db.select({ id: modulesTable.id, title: modulesTable.title }).from(modulesTable),
        db.select({ id: lessonsTable.id, title: lessonsTable.title }).from(lessonsTable),
      ]);
      content = mapContentReport(contentReport, modules, lessons);
    } catch (error) {
      contentError = error instanceof Error ? error.message : "Content report unavailable";
      console.warn("[Google Analytics] Content report failed:", contentError);
    }

    let realtime = { activeUsers: 0, eventCount: 0 };
    let realtimeError: string | undefined;
    try {
      realtime = mapRealtimeReport(await runRealtimeReport(config.propertyId, accessToken));
    } catch (error) {
      realtimeError = error instanceof Error ? error.message : "Realtime report unavailable";
      console.warn("[Google Analytics] Realtime report failed:", realtimeError);
    }

    const data = {
      ...mapAnalyticsReports(summaryReport, trendReport, pagesReport),
      content,
      ...(contentError ? { contentError } : {}),
      realtime,
      ...(realtimeError ? { realtimeError } : {}),
    };
export default router;
