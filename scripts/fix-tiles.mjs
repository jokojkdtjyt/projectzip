import https from "node:https";

const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
if (!API_KEY) throw new Error("POSTHOG_PERSONAL_API_KEY is required");
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

  // Try different tile endpoints
  for (const endpoint of [
    `/dashboards/${dashboardId}/tiles/`,
    `/dashboards/${dashboardId}/tiles`,
    `/dashboard_tiles/`,
  ]) {
    try {
      console.log(`Trying ${endpoint}…`);
      const r = await req(`${BASE}${endpoint}`, "POST", { insight: insightIds[0], dashboard: dashboardId });
      console.log(`  ✅ ${endpoint}:`, JSON.stringify(r).slice(0, 300));
    } catch (e) {
      console.log(`  ❌ ${e.message.slice(0, 300)}`);
    }
  }

  // Maybe we need to add tile via the dashboard PATCH?
  try {
    console.log(`Trying PATCH dashboard to add insight…`);
    // Get dashboard first to see its structure
    const dash = await req(`${BASE}/dashboards/${dashboardId}/`, "GET");
    console.log("Dashboard keys:", Object.keys(dash));
    console.log("Has tiles:", !!dash.tiles);
    if (dash.tiles) console.log("Tiles:", JSON.stringify(dash.tiles).slice(0, 500));
  } catch (e) {
    console.log(`  ❌ GET dashboard: ${e.message.slice(0, 300)}`);
  }
}

main();
