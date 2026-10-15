# Encrypted local follow-up queue backup acceptance

From the repository root, with pinned Playwright installed under `tools/experiments/offline-proof`:

```sh
OFFLINE_PROOF_CHROMIUM=/path/to/chromium node tools/experiments/followup-backup-browser/browser.spec.mjs
```

Eleven scenarios (twelve including the parent) use the actual FollowupsPage, download and file picker, WebCrypto and IndexedDB. A minimal HTTP fixture provides no authoritative server acceptance; sessions are explicitly injected. No import/export action may produce a POST.

Coverage includes a second browser profile, identity preservation, repeated additive restore, newer receipts, scope/phrase/tamper rejection, conflicting identities, malformed/version/size rejection, transaction abort, a receipt racing with restore, independent draft/reference/selection state, concurrent imports and process restart.

The archive contains encrypted scheduling intents only. It is not a company backup, offline login grant, key recovery scheme or current server-status attestation. Limits are 500 intents and 5 MiB per archive; this is not a throughput benchmark.
