# Offline follow-up selection acceptance

Run from the repository root after installing the pinned Playwright dependency in `tools/experiments/offline-proof`:

```sh
OFFLINE_PROOF_CHROMIUM=/path/to/chromium node tools/experiments/followup-references-browser/browser.spec.mjs
```

Nine Chromium scenarios (ten counting the parent) use the canonical FollowupsPage, encrypted IndexedDB implementation and manual request queue. A local HTTP fixture serves the JavaScript while API requests can fail. Session context is explicitly injected by the harness; this does not prove offline login or real server authorization. Coverage: data minimization and encryption, snapshot provenance, offline request creation, process restart, wrong phrase, company/branch/actor isolation, expired sessions, delayed decryption across session changes, server rejection and independent deletion. No automatic sending is implemented.
