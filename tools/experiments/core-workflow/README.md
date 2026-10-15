# Core workflow acceptance

Run from the existing repository checkout, without a Git worktree. No production database is accepted. Requires Node 24, pinned pnpm 9.15.0, Docker and prepared browser artifacts.

1. `pnpm install --frozen-lockfile && pnpm prisma:generate && pnpm --filter @elhafez/web build`
2. Start a disposable PostgreSQL 16.6 container named `elhafez-core-test`, with database `elhafez_core_test`, published only at `127.0.0.1:55432`. Use the test-only password `core-test-only`. Refuse an existing container rather than removing an unknown instance.
3. Set `DATABASE_URL=postgresql://postgres:core-test-only@127.0.0.1:55432/elhafez_core_test` and `CORE_TEST_DATABASE_URL` to that same test URL. Apply `pnpm exec prisma migrate deploy`.
4. `node --import ./apps/api/scripts/typescript-test-runtime.mjs apps/api/src/core-workflow-http.integration.ts`
5. For production-browser acceptance, provide `CORE_BROWSER_PACKAGE` pointing to a separate installed package.json containing Playwright 1.62.1 and @sparticuz/chromium 153.0.0. Run step 4 again on a fresh disposable database. Browser dependencies are test tools, not application runtime dependencies. Screenshots default to `/tmp/core-evidence`.
6. After a successful native run, `bash tools/experiments/core-workflow/recovery.sh` restores to the separate `elhafez_core_restore` database and copies/checks the test attachment. It never restores over the source database. Stop all test writers before this step.

The native fixture creates two independent test companies through Owner bootstrap/MFA/subscription provisioning, then changes temporary administrator credentials through the real API. Random credentials are generated in memory and are never checked in. This fixture is not a production bootstrap script. Do not supply personal/company data.

The browser uses the actual production artifact, static proxy, AppModule, PostgreSQL and IndexedDB. Utility storage checks use an independent local-only scope and are not financial acceptance. Source/SSR tests are separate evidence. Native and browser tests are explicit and are not silently claimed as part of ordinary `pnpm verify`.

Limitations and unproven scenarios belong in the acceptance report. A cold local process check alone does not establish network-isolated LAN readiness. The recovery fixture compares native owner data and attachment bytes; it is not an approved production recovery procedure or a proof of key recovery after losing a browser passphrase.

For isolated LAN acceptance, prepare `deploy/local/Dockerfile` while online using the session CA as a BuildKit secret and tag it `elhafez-office-runtime:node24-openssl3`. Set `CORE_LAN_IMAGE` to that tag for step 4. The script uses a Docker internal network and a separate client container; it does not depend on published host ports to cross that isolation boundary. The API image must include OpenSSL 3; a bare Node slim image is insufficient for the generated Prisma engine. No certificate verification is disabled.

`bash tools/experiments/core-workflow/upgrade.sh` independently creates `elhafez_core_upgrade`, applies accepted baseline migrations, inserts a legacy-format booking, applies the additive core migration, and verifies identity/default fallback preservation. It never targets the native acceptance database or production.
