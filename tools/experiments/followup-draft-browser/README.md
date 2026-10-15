# Real FollowupsPage local-draft acceptance

Run from the repository root:

```sh
npm ci --prefix tools/experiments/offline-proof --ignore-scripts
OFFLINE_PROOF_CHROMIUM=/path/to/chromium node tools/experiments/followup-draft-browser/browser.spec.mjs
```

Without the executable override, install Playwright's matching browser through the
isolated offline-proof package. The test bundles the canonical production
FollowupsPage and draft storage, mounts React in real Chromium, and serves fixture
GET references over loopback HTTP. Fixture session headers do not test real API
authentication. No production server or database is involved.

Nine browser scenarios cover offline saving, encrypted persisted bytes, browser
process restart, wrong secret, actor switch, expired session, company/branch
isolation, write failure preserving the prior draft, and explicit deletion. All
assert zero scheduling POST requests. Chromium runs with --no-sandbox solely for
this isolated test harness; only trusted local code is loaded.

The actual ERP shell is not service-worker cached by this change. The process
restart test loads the page online, disconnects, then restores the durable draft.
This is not acceptance of offline cold-start, synchronization, server idempotency,
real PostgreSQL, or production authentication. It is explicitly run and does not
silently add a browser download or job to normal CI.
