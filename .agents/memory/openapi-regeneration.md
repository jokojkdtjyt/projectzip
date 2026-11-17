---
name: OpenAPI regeneration
description: Keep the API contract complete before generating client and Zod types.
---

Treat OpenAPI as the source of truth for every API-facing field and operation. Before regeneration, ensure it includes the full existing contract; Orval cleans generated outputs and removes declarations missing from the spec.

**Why:** In this workspace, regenerating after an incomplete spec removed existing module fields and caused broad UI type errors. Generated React Query option types also require call sites with custom query options to provide their generated query key.

**How to apply:** Compare the OpenAPI schemas with existing routes and generated types before codegen. After regeneration, typecheck the frontend, API server, and shared libraries.

For multipart upload endpoints, keep the request body in OpenAPI so the React client generates its real `File` input. If Node-side Zod generation cannot represent browser `File`/`Blob` types, exclude that multipart body only from the Zod transformer rather than removing it from the shared contract.

**Why:** Removing multipart from the spec also removes the upload contract from the React client; Node's Zod package and the browser's upload types have different capabilities.

**How to apply:** Regenerate from the complete OpenAPI document, verify the React hook still accepts `File`, and typecheck both generated clients.
