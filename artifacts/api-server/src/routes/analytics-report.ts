const REPORT_URL = "https://analyticsdata.googleapis.com/v1beta";

export type AnalyticsErrorCode =
  | "api_disabled"
  | "property_access_denied"
  | "invalid_credentials"
  | "invalid_property_id"
  | "unknown";

export type AnalyticsResponse = {
  metricHeaders?: Array<{ name?: string }>;
  dimensionHeaders?: Array<{ name?: string }>;
  rows?: Array<{
    metricValues?: Array<{ value?: string }>;
    dimensionValues?: Array<{ value?: string }>;
  }>;
};

export type AnalyticsReportData = {
  configured: true;
  range: "Last 28 days";
  fetchedAt: string;
  summary: Record<string, number>;
  trend: Array<{ date: string; activeUsers: number; pageViews: number }>;
  topPages: Array<{ path: string; pageViews: number }>;
  realtime?: { activeUsers: number; eventCount: number };
  realtimeError?: string;
};

export type ContentAnalyticsData = {
  topModules: Array<{ id: string; title: string; activeUsers: number; pageViews: number }>;
  topLessons: Array<{ id: string; title: string; activeUsers: number; pageViews: number }>;
};

export function buildTopPagesReportRequest(
  dateRange: { startDate: string; endDate: string },
): Record<string, unknown> {
  return {
    dateRanges: [dateRange],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: "5",
  };
}

export function buildContentReportRequest(
  dateRange: { startDate: string; endDate: string },
): Record<string, unknown> {
  return {
    dateRanges: [dateRange],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: "100",
  };
}

export function classifyAnalyticsError(error: unknown): AnalyticsErrorCode {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("invalid_grant") ||
    message.includes("invalid_client") ||
    message.includes("unauthorized_client") ||
    message.includes("invalid jwt") ||
    message.includes("private key") ||
    message.includes("decoder routines") ||
    message.includes("pem routines") ||
    message.includes("service-account json") ||
    message.includes("service account json") ||
    message.includes("credentials")
  ) {
    return "invalid_credentials";
  }

  if (
    (message.includes("google analytics data api") ||
      message.includes("analyticsdata.googleapis.com")) &&
    (message.includes("not been enabled") ||
      message.includes("disabled") ||
      message.includes("enable it"))
  ) {
    return "api_disabled";
  }

  if (
    (message.includes("permission") ||
      message.includes("access") ||
      message.includes("authorized") ||
      message.includes("forbidden")) &&
    (message.includes("property") ||
      message.includes("analytics") ||
      message.includes("caller") ||
      message.includes("user") ||
      message.includes("service"))
  ) {
    return "property_access_denied";
  }

  if (
    message.includes("invalid property") ||
    (message.includes("property id") &&
      (message.includes("invalid") || message.includes("malformed") || message.includes("not found"))) ||
    (message.includes("property") && (message.includes("does not exist") || message.includes("not found"))) ||
    message.includes("requested entity was not found") ||
    (message.includes("resource name") && (message.includes("invalid") || message.includes("malformed")))
  ) {
    return "invalid_property_id";
  }

  return "unknown";
}

export async function runReport(
  propertyId: string,
  accessToken: string,
  requestBody: Record<string, unknown>,
): Promise<AnalyticsResponse> {
  const response = await fetch(
    `${REPORT_URL}/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );
  const body = (await response.json()) as AnalyticsResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Google Analytics report failed (${response.status})`);
  }
  return body;
}

export async function runRealtimeReport(
  propertyId: string,
  accessToken: string,
): Promise<AnalyticsResponse> {
  const response = await fetch(
    `${REPORT_URL}/properties/${encodeURIComponent(propertyId)}:runRealtimeReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        metrics: [{ name: "activeUsers" }, { name: "eventCount" }],
      }),
    },
  );
  const body = (await response.json()) as AnalyticsResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Google Analytics realtime report failed (${response.status})`);
  }
  return body;
}

export function mapRealtimeReport(report: AnalyticsResponse): {
  activeUsers: number;
  eventCount: number;
} {
  const headers = report.metricHeaders ?? [];
  const values = report.rows?.[0]?.metricValues ?? [];
  const metrics = Object.fromEntries(
    headers.map((header, index) => [header.name ?? `metric_${index}`, Number(values[index]?.value ?? 0)]),
  );
  return {
    activeUsers: Number(metrics.activeUsers ?? 0),
    eventCount: Number(metrics.eventCount ?? 0),
  };
}

export function mapContentReport(
  report: AnalyticsResponse,
  modules: Array<{ id: string; title: string }>,
  lessons: Array<{ id: string; title: string }>,
): ContentAnalyticsData {
  const moduleTitles = new Map(modules.map((module) => [module.id, module.title]));
  const lessonTitles = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
  const topModules: ContentAnalyticsData["topModules"] = [];
  const topLessons: ContentAnalyticsData["topLessons"] = [];

  for (const row of report.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value ?? "";
    const activeUsers = Number(row.metricValues?.[0]?.value ?? 0);
    const pageViews = Number(row.metricValues?.[1]?.value ?? 0);
    const lessonMatch = path.match(/^\/modules\/([^/]+)\/lessons\/([^/]+)\/?$/);
    const moduleMatch = path.match(/^\/modules\/([^/]+)\/?$/);

    if (lessonMatch) {
      const [, moduleId, lessonId] = lessonMatch;
      topLessons.push({
        id: lessonId,
        title: lessonTitles.get(lessonId) ?? `${moduleTitles.get(moduleId) ?? moduleId} lesson`,
        activeUsers,
        pageViews,
      });
    } else if (moduleMatch) {
      const [, moduleId] = moduleMatch;
      topModules.push({
        id: moduleId,
        title: moduleTitles.get(moduleId) ?? moduleId,
        activeUsers,
        pageViews,
      });
    }
  }

  return {
    topModules: topModules.slice(0, 5),
    topLessons: topLessons.slice(0, 5),
  };
}

function metricMap(report: AnalyticsResponse): Record<string, number> {
  const headers = report.metricHeaders ?? [];
  const values = report.rows?.[0]?.metricValues ?? [];
  return Object.fromEntries(
    headers.map((header, index) => [header.name ?? `metric_${index}`, Number(values[index]?.value ?? 0)]),
  );
}

function dateLabel(value: string): string {
  if (/^\d{8}$/.test(value)) return `${value.slice(4, 6)}/${value.slice(6, 8)}`;
  return value;
}

export function mapAnalyticsReports(
  summaryReport: AnalyticsResponse,
  trendReport: AnalyticsResponse,
  pagesReport: AnalyticsResponse,
  fetchedAt = new Date().toISOString(),
): AnalyticsReportData {
  return {
    configured: true,
    range: "Last 28 days",
    fetchedAt,
    summary: metricMap(summaryReport),
    trend: (trendReport.rows ?? []).map((row) => ({
      date: dateLabel(row.dimensionValues?.[0]?.value ?? ""),
      activeUsers: Number(row.metricValues?.[0]?.value ?? 0),
      pageViews: Number(row.metricValues?.[1]?.value ?? 0),
    })),
    topPages: (pagesReport.rows ?? []).map((row) => ({
      path: row.dimensionValues?.[0]?.value || "/",
      pageViews: Number(row.metricValues?.[0]?.value ?? 0),
    })),
  };
}
