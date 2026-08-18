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
        else reject(new Error(`${res.statusCode} ${res.statusMessage}: ${d}`));
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  // ── 1. Module Popularity (Trends, breakdown by module) ──
  console.log("Creating insight 1: Module Popularity…");
  const ins1 = await req(`${BASE}/insights/`, "POST", {
    name: "Module Popularity",
    description: "Trends chart of module_viewed events broken down by module property",
    query: {
      kind: "TrendsQuery",
      series: [{ kind: "EventsNode", event: "module_viewed", name: "module_viewed" }],
      interval: "day",
      trendsFilter: { display: "ActionsLineGraph" },
      breakdownFilter: { breakdown_type: "event", breakdown: "$module" },
    },
  });
  console.log(`  ✅ Created insight #${ins1.id}: ${ins1.name}`);

  // ── 2. Cart Conversion Funnel (FunnelsQuery) ──
  console.log("Creating insight 2: Cart Conversion Funnel…");
  const ins2 = await req(`${BASE}/insights/`, "POST", {
    name: "Cart Conversion Funnel",
    description: "Funnel: module_viewed → added_to_cart → purchase_completed",
    query: {
      kind: "FunnelsQuery",
      series: [
        { kind: "EventsNode", event: "module_viewed", name: "module_viewed" },
        { kind: "EventsNode", event: "added_to_cart", name: "added_to_cart" },
        { kind: "EventsNode", event: "purchase_completed", name: "purchase_completed" },
      ],
    },
  });
  console.log(`  ✅ Created insight #${ins2.id}: ${ins2.name}`);

  // ── 3. Cart Additions Daily Trend (Trends, daily) ──
  console.log("Creating insight 3: Cart Additions Daily Trend…");
  const ins3 = await req(`${BASE}/insights/`, "POST", {
    name: "Cart Additions Daily Trend",
    description: "Daily trend of added_to_cart events",
    query: {
      kind: "TrendsQuery",
      series: [{ kind: "EventsNode", event: "added_to_cart", name: "added_to_cart" }],
      interval: "day",
      trendsFilter: { display: "ActionsLineGraph" },
    },
  });
  console.log(`  ✅ Created insight #${ins3.id}: ${ins3.name}`);

  // ── 4. Create Dashboard ──
  console.log("Creating dashboard…");
  const dash = await req(`${BASE}/dashboards/`, "POST", {
    name: "PreClinik Analytics (Live)",
  });
  console.log(`  ✅ Created dashboard #${dash.id}: ${dash.name}`);

  // ── 5. Add all 3 insights as tiles ──
  for (const ins of [ins1, ins2, ins3]) {
    console.log(`  Adding insight #${ins.id} as tile…`);
    await req(`${BASE}/dashboards/${dash.id}/tiles/`, "POST", { insight: ins.id });
    console.log(`    ✅ Tile added`);
  }

  const url = `https://eu.posthog.com/project/${PROJECT_ID}/dashboard/${dash.id}`;
  console.log(`\n🎉 Dashboard URL: ${url}`);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
