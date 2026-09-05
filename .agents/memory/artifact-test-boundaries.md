---
name: Artifact test boundaries
description: Where regression tests should live in this pnpm artifact workspace.
---

Keep regression tests and their source imports inside the artifact package that owns the behavior. When a test in one artifact imports source from another artifact, that package's TypeScript `rootDir` check rejects the test even if the runtime test can execute.

**Why:** The API and web artifacts use separate TypeScript projects and independently typecheck their `src` trees; keeping tests local preserves those package boundaries.

**How to apply:** Put API mapping/request tests in `artifacts/api-server`, put web client/panel tests in `artifacts/preclinik`, and share only through an intentional library package when cross-artifact reuse is required.