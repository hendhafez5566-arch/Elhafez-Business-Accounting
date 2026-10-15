# Offline feasibility experiment — TEST DATA ONLY

This is an isolated executable experiment, not an ERP module, production API,
financial ledger or implementation of full-system offline support. The application
imports none of these files. It creates temporary browser profiles and a temporary
SQLite database, listens only on loopback and deletes the test state on completion.

## Reproduce

Requires Node 24+ and a Chromium browser supported by Playwright. Install this
standalone experiment's locked tooling (not the ERP workspace dependencies):

```bash
npm ci --prefix tools/experiments/offline-proof
cd tools/experiments/offline-proof
npx playwright install chromium
npm test
```

If Chromium is already installed, set `OFFLINE_PROOF_CHROMIUM` to its executable
path when running the test. Missing browser/tooling fails explicitly; there is no
skip, mock-browser fallback or hidden success. The browser launches without its
OS sandbox for the isolated loopback test environment, so never use this launcher
with untrusted pages or real data.

The experiment is intentionally not part of the default application test command:
it requires an installed real browser and Node 24's SQLite API. Run it explicitly
before using it as evidence. The ordinary application CI results are separate.

## What the code does

- Real Chromium IndexedDB persists immutable request envelopes and attachments.
- PBKDF2 derives a non-exportable AES-GCM key from an unlock secret and per-scope salt.
  Ciphertexts bind operation ID and company/branch/user/device scope as AAD. The key
  exists only in the page process; reopening requires unlocking again.
- Service worker caches only this experiment's static shell; it never returns a
  fabricated success for a failed API request.
- Pending requests retain the original ID/payload across retries. Confirmed results,
  review-required outcomes and network retries have distinct states.
- The test server uses durable SQLite transaction receipts and payload hashes,
  version comparisons and an atomic one-slot decrement.
- Server fault controls deliberately abort an actual transaction after writing,
  or drop a response after COMMIT. The local fault aborts a real IndexedDB transaction.

## Limits

The actor header and known test identities are fixtures, NOT real authentication.
The experiment verifies scope decisions for those fixtures, not production JWT,
MFA, offline authorization signing, endpoint hardening or employee permissions.
Unlock secret, expiry and device scope are supplied by the test; production must
use a trusted authorization envelope and server policy, not client-declared expiry.

No PostgreSQL integration, PostingService, financial period validation, real booking,
number issuance, mobile app, backup restoration of an unsent queue, key recovery,
XSS mitigation, quota exhaustion, multi-tab race or upload resumption is certified.
The attachment is a bounded test payload; it is encrypted/recovered/uploaded with a
checksum, not streamed in resumable chunks. AES-GCM here is proof of mechanics,
not a security audit or a substitute for production threat modeling.

The server serializes requests through SQLite transactions; this does not replace
a PostgreSQL concurrency test across multiple production processes. The one slot
is an explicitly synthetic test resource, not a real tourism inventory record.
