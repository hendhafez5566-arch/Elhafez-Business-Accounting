# Public production shell acceptance

From the repository root:

```sh
pnpm --filter @elhafez/web build
node --test tools/experiments/offline-shell-browser/delivery.spec.mjs
OFFLINE_PROOF_CHROMIUM=/path/to/chromium node tools/experiments/offline-shell-browser/browser.spec.mjs
```

Uses Playwright pinned by `tools/experiments/offline-proof/package-lock.json` and the actual production web artifact. A local HTTP fixture serves the files with the production CSP, and can disappear or offer replacement workers. It is not a live Nest/PostgreSQL test. Eight scenarios (nine with the parent test) cover installation, process restart, deep links, failed offline login, exclusions, cache contents, waiting updates, incomplete installation and an unprepared first visit. No API or Owner response should enter Cache Storage. This test does not assert offline authentication or full-system operation.
