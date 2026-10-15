# Offline coordination

Coordination owns scoped delegation metadata and immutable command receipts. It owns no debt, balance, posting, capacity or final booking status. The API composition root checks current platform authorization and delegates to public booking/TFO services. Owner services retain economic idempotency and current period/capacity checks.

`BOOKING_CREATE`, `BOOKING_CONFIRM` and `BOOKING_DEPOSIT` are provisional on a disconnected device. An expired or revoked delegation moves a received request to REVIEW. Cash observation payloads remain durable, without claiming the receipt was financially accepted. Current authenticated branch access is still required to submit; a disabled user retains the encrypted device queue until an authorized recovery process is available.

Leases prevent ordinary simultaneous processing. A lease is not an economic lock: retries after worker failure always use the same owner key, including after lease expiry. Unknown outcomes remain pending. Accepted responses are reauthorized when replayed. There is no automatic promotion, cloud/office replication or multi-master ledger.

Run `pnpm --filter @elhafez/offline-coordination test`. Real PostgreSQL/HTTP validation is recorded separately; unit fixtures are not database acceptance.
