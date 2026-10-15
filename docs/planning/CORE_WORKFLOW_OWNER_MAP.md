# Core workflow implementation boundary

Execution branch: `codex/core-workflow-offline`; PR base: `development/flexible-section-ui`.
Existing checkout, no worktree. Historical requirements are the supplied register; original Claude conversations were not found and are not reconstructed.

| Change | Canonical owner / public contract | Persistence | Required evidence |
|---|---|---|---|
| Contracting customer vs non-traveling financial customer and family reference | hajj-umrah-bookings / create, confirm; customer-management / requireActiveForIntegration | additive hub_bookings columns; debtor passed once to TFO/Billing | family of four, separate debtor; cross-company rejection; actual PostgreSQL round trip |
| Principal/subordinate commercial agreement | agent-management / immutable agreement snapshot | existing agreement history | active same-company parties, retained prior agreement |
| Exact commission allocation | expense-commission-recognition / public allocation policy; tourism-finance-orchestration / confirm/cancel | immutable workflow payload and all claim references | exact independent totals, retry and cancellation of every claim |
| Disconnected request coordination | planned offline-coordination, created from template | coordination metadata only | scoped grants, stable identities, denied/conflict review; owners revalidate effects |
| Browser views | existing booking workspace, local components | no financial source truth | RTL, forms, pending/error states; actual browser checks |
| LAN and recovery | platform-core / authentication; platform-operations / backup; existing owners | existing PostgreSQL and file storage | cold start offline, clean recovery with hashes and pending requests |

Shared kernel, historical migrations, global presentation, unrelated Hajj/HR/WhatsApp/OCR remain outside implementation. No financial or capacity ledger in coordination. No automatic authority promotion or last-write-wins. No claim of final disconnected confirmation without capacity ownership.
