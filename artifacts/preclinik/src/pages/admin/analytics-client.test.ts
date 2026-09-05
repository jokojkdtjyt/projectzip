import assert from "node:assert/strict";
import test from "node:test";
import { fetchAnalytics } from "./analytics-client";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("keeps configured Google API errors visible to the analytics panel", async () => {
  const body = {
    configured: true,
    error: "Google Analytics Data API has not been enabled",
  };
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });

  assert.deepEqual(await fetchAnalytics(() => Promise.resolve("access-token")), body);
});