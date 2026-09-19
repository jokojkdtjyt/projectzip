---
name: Analytics route merge safety
description: Merge risk around the protected Google Analytics route.
---

After merging changes to the protected analytics route, verify that its configuration guard, cache return, report try/catch, response, and router export are all still present before restarting the API.

**Why:** A remediation merge previously left duplicated declarations and removed the route closure, which made the API fail to compile and made the rest of the app appear broken.

**How to apply:** Run the API typecheck/build and health check immediately after any analytics-route merge; do not diagnose Google data until the server is compiling and listening.