---
name: External database override
description: How this app selects its PostgreSQL connection in Replit.
---

The API and database package prefer `EXTERNAL_DATABASE_URL` over Replit’s runtime-managed `DATABASE_URL`.

**Why:** Replit reserves `DATABASE_URL` as a runtime-managed key, while this imported app needs to connect to an externally provisioned Neon database.

**How to apply:** Set the Neon connection as the secure `EXTERNAL_DATABASE_URL` secret and restart the API workflow so its connection pool picks up the change.