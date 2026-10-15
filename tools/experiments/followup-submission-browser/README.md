# Canonical follow-up durable submission browser acceptance

From the repository root:

```sh
npm ci --prefix tools/experiments/offline-proof --ignore-scripts
OFFLINE_PROOF_CHROMIUM=/path/to/chromium node tools/experiments/followup-submission-browser/browser.spec.mjs
```

Uses the pinned Playwright dependency of the isolated offline proof. It bundles
and mounts the actual FollowupsPage, IndexedDB storage, submission hook and
crmRequest transport. Thirteen scenarios run through real HTTP in real Chromium.
The server is explicitly a fixture with an in-memory receipt map, not the actual
Nest API, PostgreSQL or JWT/RBAC. Native PostgreSQL acceptance is a separate test
in the owning crm-followups module and existing CI job.

The suite proves client identity persistence across browser-process restart,
partial response loss after fixture acceptance, immutable retry data, encrypted
storage, refusal to discard an unknown result, malformed response recovery,
write failure preventing HTTP, two-tab CAS convergence, permission denial and
later recovery, actor isolation and a principal switch during encryption. A
bounded-timeout scenario shortens AbortSignal.timeout inside the test only;
production uses 20 seconds.

Browser restart loads the screen online, then restores persisted requests.
Offline shell cold-start is not tested. --no-sandbox is used only for the
isolated trusted local harness. No browser download or extra CI job is silently
introduced by this suite. Run it explicitly; a missing browser fails the test.
