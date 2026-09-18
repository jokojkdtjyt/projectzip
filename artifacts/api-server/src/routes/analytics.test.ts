import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTopPagesReportRequest,
  buildContentReportRequest,
  classifyAnalyticsError,
  mapContentReport,
  mapAnalyticsReports,
  mapRealtimeReport,
  runReport,
  runRealtimeReport,
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

test("classifies the Google Analytics setup errors for targeted admin guidance", () => {
  assert.equal(
    classifyAnalyticsError(
      new Error(
        "Google Analytics Data API has not been enabled in project 123 or it is disabled",
      ),
    ),
    "api_disabled",
  );
  assert.equal(
    classifyAnalyticsError(
      new Error("User does not have sufficient permissions for this property"),
    ),
    "property_access_denied",
  );
  assert.equal(classifyAnalyticsError(new Error("Invalid property ID")), "invalid_property_id");
  assert.equal(
    classifyAnalyticsError(new Error("Google token request failed: invalid_grant")),
    "invalid_credentials",
  );
  assert.equal(
    classifyAnalyticsError(new Error("error:1E08010C:DECODER routines::unsupported")),
    "invalid_credentials",
  );
  assert.equal(
    classifyAnalyticsError(new Error("Google Analytics service-account JSON is missing required fields")),
    "invalid_credentials",
  );
  assert.equal(classifyAnalyticsError(new Error("Property 123 was not found")), "invalid_property_id");
});

test("builds a GA4 top-pages sort with desc at the order-by level", () => {
  const request = buildTopPagesReportRequest({
    startDate: "28daysAgo",
    endDate: "today",
  }) as {
    orderBys: Array<{
      metric: { metricName: string; desc?: boolean };
      desc?: boolean;
    }>;
  };

  assert.deepEqual(request.orderBys, [
    { metric: { metricName: "screenPageViews" }, desc: true },
  ]);
});

test("builds and maps module and lesson content rankings by route", () => {
  assert.deepEqual(
    buildContentReportRequest({ startDate: "28daysAgo", endDate: "today" }),
    {
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: "100",
    },
  );

  assert.deepEqual(
    mapContentReport(
      {
        rows: [
          {
            dimensionValues: [{ value: "/modules/cardio-foundations" }],
            metricValues: [{ value: "8" }, { value: "21" }],
          },
          {
            dimensionValues: [{ value: "/modules/cardio-foundations/lessons/cv-l1" }],
            metricValues: [{ value: "5" }, { value: "13" }],
          },
          {
            dimensionValues: [{ value: "/catalog" }],
            metricValues: [{ value: "20" }, { value: "40" }],
          },
        ],
      },
      [{ id: "cardio-foundations", title: "Cardio Foundations" }],
      [{ id: "cv-l1", title: "Heart anatomy" }],
    ),
    {
      topModules: [
        {
          id: "cardio-foundations",
          title: "Cardio Foundations",
          activeUsers: 8,
          pageViews: 21,
        },
      ],
      topLessons: [
        {
          id: "cv-l1",
          title: "Heart anatomy",
          activeUsers: 5,
          pageViews: 13,
        },
      ],
    },
  );
});

test("maps the realtime active-user and event counts", () => {
  assert.deepEqual(
    mapRealtimeReport({
      metricHeaders: [{ name: "activeUsers" }, { name: "eventCount" }],
      rows: [{ metricValues: [{ value: "2" }, { value: "17" }] }],
    }),
    { activeUsers: 2, eventCount: 17 },
  );
});

test("uses the GA4 realtime report endpoint", async () => {
  let requestUrl = "";
  let requestBody = "";
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = String(init?.body ?? "");
    return response({
      metricHeaders: [{ name: "activeUsers" }, { name: "eventCount" }],
      rows: [{ metricValues: [{ value: "1" }, { value: "3" }] }],
    });
  };

  const report = await runRealtimeReport("404322982", "access-token");
  assert.equal(requestUrl, "https://analyticsdata.googleapis.com/v1beta/properties/404322982:runRealtimeReport");
  assert.deepEqual(JSON.parse(requestBody), {
    metrics: [{ name: "activeUsers" }, { name: "eventCount" }],
  });
  assert.equal(report.rows?.[0]?.metricValues?.[0]?.value, "1");
});
