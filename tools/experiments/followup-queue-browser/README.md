# Multi-item follow-up queue browser acceptance

From repository root:

```sh
npm ci --prefix tools/experiments/offline-proof --ignore-scripts
OFFLINE_PROOF_CHROMIUM=/path/to/chromium node tools/experiments/followup-queue-browser/browser.spec.mjs
```

Bundles the actual FollowupsPage and production storage/hook/queue component in
real Chromium. Fifteen scenarios cover version-1 encrypted record migration,
wrong phrase, transaction abort preserving legacy bytes, two-tab migration,
version-1 clients failing closed, multiple offline requests, process restart,
pinned selection, per-row retries, independent denial, lost response, encrypted
scope isolation, concurrent creation/retry and accepted legacy preservation.
The compatible legacy fixture also contains an ordinary draft to prove it survives.

The HTTP receipt server is an explicit fixture, not the production API or RBAC.
Real authenticated AppModule/PostgreSQL acceptance is a separate existing CI step.
The older submission and draft browser suites are rerun without removing tests.
Browser restart loads the screen online before working with local storage.
No offline cold-start or large-queue performance claim is made. Test launch uses
--no-sandbox only for trusted local fixtures. Profiles are temporary and removed.
