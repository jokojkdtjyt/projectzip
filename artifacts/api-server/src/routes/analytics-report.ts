const REPORT_URL = "https://analyticsdata.googleapis.com/v1beta";

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
};

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