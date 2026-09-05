import assert from "node:assert/strict";
import test from "node:test";
import {
  mapAnalyticsReports,
  runReport,
  type AnalyticsResponse,
} from "./analytics-report";

const originalFetch = globalThis.fetch;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("maps GA4 summary, 28-day trend, and top-page reports into the dashboard shape", () => {
  const summaryReport: AnalyticsResponse = {
    metricHeaders: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "engagementRate" },
    ],
    rows: [
      {
        metricValues: [
          { value: "1200" },
          { value: "850" },
          { value: "4200" },
          { value: "0.638" },
        ],
      },
    ],
  };
  const trendReport: AnalyticsResponse = {
    dimensionHeaders: [{ name: "date" }],
    rows: [
      {
        dimensionValues: [{ value: "20260810" }],
        metricValues: [{ value: "40" }, { value: "120" }],
      },
      {
        dimensionValues: [{ value: "20260811" }],
        metricValues: [{ value: "45" }, { value: "138" }],
      },
    ],
  };
  const pagesReport: AnalyticsResponse = {
    dimensionHeaders: [{ name: "pagePath" }],
    rows: [
      {
        dimensionValues: [{ value: "/courses/intro" }],
        metricValues: [{ value: "600" }],
      },
      {
        dimensionValues: [],
        metricValues: [{ value: "12" }],
      },
    ],
  };

  assert.deepEqual(
    mapAnalyticsReports(summaryReport, trendReport, pagesReport, "2026-09-05T12:00:00.000Z"),
    {
      configured: true,
      range: "Last 28 days",
      fetchedAt: "2026-09-05T12:00:00.000Z",
      summary: {
        activeUsers: 1200,
        sessions: 850,
        screenPageViews: 4200,
        engagementRate: 0.638,
      },
      trend: [
        { date: "08/10", activeUsers: 40, pageViews: 120 },
        { date: "08/11", activeUsers: 45, pageViews: 138 },
      ],
      topPages: [
        { path: "/courses/intro", pageViews: 600 },
        { path: "/", pageViews: 12 },
      ],
    },
  );
});

test("surfaces the Google API error instead of treating a failed report as data", async () => {
  globalThis.fetch = async () =>
    response({ error: { message: "Google Analytics Data API has not been enabled" } }, 403);

  await assert.rejects(
    runReport("123456", "access-token", { metrics: [{ name: "activeUsers" }] }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Google Analytics Data API has not been enabled",
  );
});