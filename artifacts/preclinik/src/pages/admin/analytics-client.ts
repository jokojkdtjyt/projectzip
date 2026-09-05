export type AnalyticsData = {
  configured: boolean;
  range?: string;
  fetchedAt?: string;
  summary?: {
    activeUsers?: number;
    sessions?: number;
    screenPageViews?: number;
    engagementRate?: number;
  };
  trend?: Array<{ date: string; activeUsers: number; pageViews: number }>;
  topPages?: Array<{ path: string; pageViews: number }>;
  error?: string;
};

export async function fetchAnalytics(
  getToken: () => Promise<string | null>,
): Promise<AnalyticsData> {
  const token = await getToken();
  const response = await fetch("/api/admin/analytics", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = (await response.json()) as AnalyticsData;
  if (!response.ok && !body.configured) {
    throw new Error(body.error ?? `Analytics request failed: ${response.status}`);
  }
  return body;
}