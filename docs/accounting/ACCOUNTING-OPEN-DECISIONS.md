# Accounting Open Decisions

No item below may be guessed or silently converted into scope.

| ID | Decision | Evidence needed / decision gate | Earliest affected phase |
|---|---|---|---|
| OD-01 | Egyptian Government E-Invoice integration | statutory requirements, credentials, document types, environment and compliance owner | after AC-06 |
| OD-02 | Direct Bank API / Bank Feed | target banks, feed/API formats, consent/security, matching SLA | after AC-07 |
| OD-03 | Full annual carry-forward workflow | accountant-approved opening/carry-forward policy and migrated-history strategy | before AC-14 |
| OD-04 | Global idempotency policy | command/event identity, retention, conflict, replay and transport semantics; Billing allocation commands already require a local source-intent identity but the global policy remains undecided | before cross-module production integration |
| OD-05 | Automatic schedule posting during close | whether due schedules block, warn, or post; authorization and reversal | before AC-08 close integration |
| OD-06 | Multi-company consolidation | entities, eliminations, ownership, currencies and statements | separate future program |
| OD-07 | Production prevalence of advanced legacy features | anonymized production evidence and migration decision per feature | before AC-09/14 |
| OD-08 | Full durable Umrah outbox semantics | ordering, lease, retry, dead-letter, inbox, recovery and observability contract | before AC-12 production transport |
| OD-09 | Changes-in-Equity statement | required format, local/statutory/management basis | before AC-13 |
| OD-10 | IAS 7 detailed cash-flow classification | account/activity mapping and accountant approval | before AC-13 |

Additional implementation choices deliberately not fixed here: physical schemas, API/transport, sync/async choice, database split, migration tooling, and historical migration depth.
