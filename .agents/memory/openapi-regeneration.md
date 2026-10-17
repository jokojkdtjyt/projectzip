---
name: OpenAPI regeneration
description: Keep the API contract complete before generating client and Zod types.
---

Treat OpenAPI as the source of truth for every API-facing field and operation. Before regeneration, ensure it includes the full existing contract; Orval cleans generated outputs and removes declarations missing from the spec.

**Why:** In this workspace, regenerating after an incomplete spec removed existing module fields and caused broad UI type errors. Generated React Query option types also require call sites with custom query options to provide their generated query key.

**How to apply:** Compare the OpenAPI schemas with existing routes and generated types before codegen. After regeneration, typecheck the frontend, API server, and shared libraries.
