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

// Try POST with the new query format first
async function main() {
  // Try an insight with new query format
  console.log("Trying new query format…");
  try {
    const r = await req(`${BASE}/insights/`, "POST", {
      name: "Test — Module Popularity",
      description: "test",
      query: {
        kind: "TrendsQuery",
        series: [{ kind: "EventsNode", event: "module_viewed", name: "module_viewed" }],
        interval: "day",
        trendsFilter: { display: "ActionsLineGraph" },
        breakdownFilter: { breakdown_type: "event", breakdown: "$module" },
      },
    });
    console.log("SUCCESS:", JSON.stringify(r, null, 2).slice(0, 500));
    // cleanup
    await req(`${BASE}/insights/${r.id}/`, "DELETE", {});
    console.log("Deleted test insight");
  } catch (e) {
    console.log("New format failed:", e.message.slice(0, 500));
  }

  // Try listing recent insights
  try {
    const list = await req(`${BASE}/insights/?limit=3`, "GET");
    for (const ins of list.results || []) {
      console.log(`\nInsight #${ins.id}: ${ins.name}`);
      console.log("Has filters:", !!ins.filters, "Has query:", !!ins.query);
      if (ins.query) console.log("Query keys:", Object.keys(ins.query), "sample:", JSON.stringify(ins.query).slice(0, 300));
    }
  } catch (e) {
    console.log("List failed:", e.message.slice(0, 500));
  }
}
main();
