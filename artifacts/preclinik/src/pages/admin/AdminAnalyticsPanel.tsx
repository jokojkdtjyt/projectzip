import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Clock3, Eye, Loader2, RefreshCw, Users } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAnalytics } from "./analytics-client";

function formatNumber(value: number | undefined): string {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatPercent(value: number | undefined): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

export default function AdminAnalyticsPanel() {
  const { getToken } = useAuth();
  const analytics = useQuery({
    queryKey: ["/admin/analytics"],
    queryFn: () => fetchAnalytics(() => getToken()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const data = analytics.data;

  return (
    <section className="overflow-hidden rounded-[22px] border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border bg-secondary/30 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-lg font-bold">Google Analytics</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {data?.range ?? "Live website performance"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => analytics.refetch()}
          disabled={analytics.isFetching}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-primary/30 hover:bg-secondary disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${analytics.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="p-6">
        {analytics.isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Google Analytics…
          </div>
        ) : analytics.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <p className="font-bold">Analytics could not be loaded.</p>
            <p className="mt-1 text-xs">
              Check the Google service-account access and GA4 Property ID in the project configuration.
            </p>
          </div>
        ) : !data?.configured ? (
          <div className="rounded-2xl border border-[#e8ddd5] bg-[#f7f3ec] p-5 text-sm text-muted-foreground">
            <p className="font-bold text-foreground">Connect Google Analytics reporting</p>
            <p className="mt-1 text-xs leading-relaxed">
              Add a read-only Google Analytics service account and Property ID to display live reports here.
            </p>
          </div>
        ) : data.error ? (
          <AnalyticsErrorNotice code={data.errorCode} message={data.error} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Active users" value={formatNumber(data.summary?.activeUsers)} icon={Users} />
              <MetricCard label="Sessions" value={formatNumber(data.summary?.sessions)} icon={Clock3} />
              <MetricCard label="Page views" value={formatNumber(data.summary?.screenPageViews)} icon={Eye} />
              <MetricCard label="Engagement rate" value={formatPercent(data.summary?.engagementRate)} icon={BarChart3} />
              <MetricCard label="Realtime users" value={formatNumber(data.realtime?.activeUsers)} icon={Activity} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Realtime events in the last few minutes:{" "}
              <span className="font-bold text-foreground">{formatNumber(data.realtime?.eventCount)}</span>
              {data.realtime?.eventCount
                ? " — tracking is receiving events; standard reports may still be processing."
                : " — no events are visible right now. Keep this page open, browse the site in another tab, then refresh."}
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.8fr]">
              <div>
                <h3 className="mb-4 text-sm font-bold text-foreground">Visitors over time</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trend ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd5" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8a7770" }} tickLine={false} axisLine={false} minTickGap={22} />
                      <YAxis tick={{ fontSize: 10, fill: "#8a7770" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, borderColor: "#e8ddd5", fontSize: 12 }}
                        labelStyle={{ fontWeight: 700, color: "#1a1211" }}
                      />
                      <Line type="monotone" dataKey="activeUsers" name="Active users" stroke="#8b1a2f" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="mb-4 text-sm font-bold text-foreground">Top pages</h3>
                <div className="space-y-2">
                  {(data.topPages ?? []).map((page) => (
                    <div key={page.path} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
                      <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{page.path}</span>
                      <span className="shrink-0 text-xs font-bold text-foreground">{formatNumber(page.pageViews)}</span>
                    </div>
                  ))}
                  {(data.topPages ?? []).length === 0 && (
                    <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                      No page-view data yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <ContentRanking
                title="Most viewed modules"
                items={data.content?.topModules ?? []}
              />
              <ContentRanking
                title="Most viewed lessons"
                items={data.content?.topLessons ?? []}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Detail-page views show which modules and lessons attract attention; users are unique active users for each page.
            </p>
            {data.contentError && (
              <p className="mt-3 text-xs text-amber-700">
                Content ranking unavailable: {data.contentError}
              </p>
            )}
            {data.fetchedAt && (
              <p className="mt-6 text-right font-mono text-[10px] text-muted-foreground">
                Updated {new Date(data.fetchedAt).toLocaleTimeString()}
              </p>
            )}
            {data.realtimeError && (
              <p className="mt-2 text-right text-xs text-amber-700">
                Realtime check unavailable: {data.realtimeError}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function AnalyticsErrorNotice({
  code,
  message,
}: {
  code: "api_disabled" | "property_access_denied" | "unknown" | undefined;
  message: string;
}) {
  if (code === "api_disabled") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <p className="font-bold">Enable the Google Analytics Data API</p>
        <p className="mt-1 text-xs leading-relaxed">
          The Google Analytics Data API is disabled for the Google Cloud project. Open the Google Cloud API Library,
          select <span className="font-bold">Google Analytics Data API</span>, click <span className="font-bold">Enable</span>,
          then refresh this report.
        </p>
        <a
          href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-bold text-amber-900 underline underline-offset-2 hover:text-amber-700"
        >
          Open Google Cloud API Library
        </a>
        <p className="mt-4 border-t border-amber-200 pt-3 text-[11px] leading-relaxed text-amber-900/80">
          Google response: {message}
        </p>
      </div>
    );
  }

  if (code === "property_access_denied") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <p className="font-bold">Grant the service account access to this GA4 property</p>
        <p className="mt-1 text-xs leading-relaxed">
          The Google service account is valid, but it cannot read this property. In Google Analytics, open
          <span className="font-bold"> Admin → Property access management</span>, add the service-account email from
          <span className="font-bold"> GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON</span>, give it the
          <span className="font-bold"> Viewer</span> role, then refresh this report.
        </p>
        <a
          href="https://analytics.google.com/analytics/web/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-bold text-amber-900 underline underline-offset-2 hover:text-amber-700"
        >
          Open Google Analytics
        </a>
        <p className="mt-4 border-t border-amber-200 pt-3 text-[11px] leading-relaxed text-amber-900/80">
          Google response: {message}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <p className="font-bold">Google Analytics returned an error.</p>
      <p className="mt-1 text-xs">
        Check that the Google Analytics Data API is enabled, the service account has Viewer access to the GA4
        property, and the Property ID is correct.
      </p>
      <p className="mt-4 border-t border-red-200 pt-3 text-[11px] leading-relaxed text-red-700/80">
        Google response: {message}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-border bg-[#f7f3ec] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 font-serif text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function ContentRanking({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; activeUsers: number; pageViews: number }>;
}) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-bold text-foreground">{title}</h3>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-5 shrink-0 text-center font-mono text-[10px] font-bold text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 truncate text-xs font-bold text-foreground">{item.title}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3 font-mono text-[10px] text-muted-foreground">
              <span title="Unique active users">{formatNumber(item.activeUsers)} users</span>
              <span title="Detail page views">{formatNumber(item.pageViews)} views</span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            No content views yet.
          </p>
        )}
      </div>
    </div>
  );
}