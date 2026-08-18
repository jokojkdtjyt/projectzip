import https from "node:https";

const API_KEY = "REDACTED_POSTHOG_PERSONAL_API_KEY";
const PROJECT_ID = "230774";
const BASE = `https://eu.posthog.com/api/projects/${PROJECT_ID}`;
const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` };

function req(url, method, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    if (payload) HEADERS["Content-Length"] = Buffer.byteLength(payload);
    const opts = { hostname: parsed.hostname, port: 443, path: parsed.pathname + parsed.search, method, headers: { ...HEADERS } };
    const r = https.request(opts, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(d));
        else reject(new Error(`${res.statusCode}: ${d}`));
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  const dashboardId = 844979;
  const insightIds = [5144872, 5144873, 5144874];

  // Try 1: POST to /api/projects/{id}/dashboard_tiles/ (top-level, not nested under dashboard)
  try {
    console.log("Trying POST /dashboard_tiles/...");
    const r = await req(`${BASE}/dashboard_tiles/`, "POST", {
      insight: insightIds[0],
      dashboard: dashboardId,
    });
    console.log("  ✅", JSON.stringify(r).slice(0, 300));
  } catch (e) {
    console.log("  ❌", e.message.slice(0, 300));
  }

  // Try 2: Look at dashboard response to see if tiles are embedded
  try {
    console.log("Getting dashboard...");
    const dash = await req(`${BASE}/dashboards/${dashboardId}/`, "GET");
    console.log("Keys:", Object.keys(dash));
    if (dash.tiles) console.log("Tiles:", JSON.stringify(dash.tiles).slice(0, 500));
    // Check for any embedded URLs or methods
    console.log("Has tiles endpoint?", "tiles" in dash, "Has items?", "items" in dash);
  } catch (e) {
    console.log("  ❌", e.message.slice(0, 300));
  }

  // Try 3: Maybe PATCH the insight to link it to the dashboard?
  try {
    console.log("Trying PATCH insight to add dashboard...");
    const r = await req(`${BASE}/insights/${insightIds[0]}/`, "PATCH", {
      dashboards: [dashboardId],
    });
    console.log("  ✅", JSON.stringify(r).slice(0, 300));
  } catch (e) {
    console.log("  ❌", e.message.slice(0, 300));
  }
}

main();
