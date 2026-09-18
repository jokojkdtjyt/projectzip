---
name: GA4 report ordering
description: The Google Analytics Data API schema for descending metric order.
---

The GA4 Data API expects a descending sort as `{ metric: { metricName: "..." }, desc: true }`; `desc` is not a field inside the metric definition.

**Why:** Google returns an invalid-payload error when `desc` is nested under `metric`, causing the entire admin analytics report request to fail even when credentials and property access are correct.

**How to apply:** Use the top-level `desc` form for metric orderings and keep a request-shape regression test alongside analytics report tests.