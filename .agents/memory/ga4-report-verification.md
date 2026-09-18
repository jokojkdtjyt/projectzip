---
name: GA4 report verification
description: How to distinguish a working GA4 connection from delayed or missing event data.
---

Use both the standard Data API report and a realtime report when diagnosing analytics. A successful standard report request with zero rows proves the API connection and permissions, but not that recent frontend events have been processed.

**Why:** Standard GA4 reporting can lag or be empty for a new property, while realtime data gives the quickest signal that the configured measurement stream is receiving events.

**How to apply:** Show realtime active users/event counts alongside the historical report, and ask the admin to browse the site in one tab and refresh the panel in another.