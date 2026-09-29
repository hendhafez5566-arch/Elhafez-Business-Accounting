# Procurement + Tourism Literal Legacy UI Audit

Phase 1 evidence ledger for `feature/procurement-tourism-full-legacy-parity`. OLD is functional/UI/UX evidence only; NEW ownership and public module boundaries remain authoritative.

## Tourism contract workspace

Reviewed OLD `src/core/umrah/forms.ts` and `src/core/umrah/ui-pages.ts`.

### Picker behavior
OLD program pickers were searchable and showed contextual information instead of opaque IDs. Program choices excluded cancelled programs; sale-program choices additionally required active/open sale state and respected sales-close dates. Results surfaced program code/name, departure date/status and availability context.

NEW decision: preserve discoverability using canonical Tourism Programs and Contract Inventory read models. Never reproduce OLD storage or direct cross-module reads.

### Workspace structure
OLD grouped contract work into overview, contracts, live inventory, program allocations, and finance/procurement views, with hotel/flight/transport/visa/contracted-service filtering. Rows exposed supplier, effective period/release behavior, total/allocated/used/available capacity, validation/lifecycle state, and contextual actions. Actions included details, allocation, edit, amendment, confirmation where allowed, and procurement navigation.

NEW decision: compose existing owners. Contract lifecycle/capacity stays in `tourism-contract-inventory`; supplier identity/lifecycle in `supplier-management`; procurement commitments in procurement owners; financial truth in Billing/Accounting/Treasury.

### Hotel contracts
Literal OLD coverage: hotel name/short name, city, supplier picker with quick-create convenience, effective dates, currency, board basis, single/double/triple/quad/quint room quantities and nightly rates, dated seasonal quantity/rate overrides, cancellation policy, and contract attachments. OLD explicitly stated the contract itself did not create debt.

NEW mapping: capacity/availability belongs to Contract Inventory; commercial terms may live in versioned contract terms; supplier selection uses Supplier Management; attachments use Platform Core; payable/accounting effects stay with procurement/Billing/Accounting/Treasury.

### Flight blocks
Literal OLD coverage: block name, airline, supplier picker, outbound flight/origin/destination/datetime, return flight/origin/destination/datetime, total seats, cost per seat/currency, ticketing deadline, fare class, baggage, and contract attachments.

NEW mapping: capacity/service-date inventory stays in Contract Inventory. Descriptive commercial terms may be versioned terms where they do not duplicate another owner. Cost/currency remain commercial inputs and must not become parallel payable, ledger, settlement, or profitability truth in Tourism.

### Operational cues
OLD rows showed supplier context, release/cutoff behavior, capacity and availability, stop-sale/released state, validation warnings/errors, lifecycle status, and guarded action menus. Cost visibility was permission-gated.

NEW parity requirement: canonical read models should provide human-selectable contract/resource options plus availability context, preserving existing permissions/scopes and finance permission boundaries.

## Current NEW checkpoint
The branch already contains canonical inventory catalog work and it must not be reimplemented: `3b290eaa` exports the read service/types; `9ed74aa2` exposes the authenticated catalog endpoint; `976a52cb` registers it; `5a419288` exposes typed catalog reads to the web client.

The current Contract Inventory page still uses free-text contract/resource IDs in the allocation area although the typed catalog is available. Next UI gap: use that catalog for contract/resource selection and contextual availability, retaining direct-ID lookup only where intentionally administrative.

## Remaining literal audit queue
Remaining Tourism operations/workflow pages and smoke references; supplier/party browser smoke and document controls; transport/visa/contracted-service form details; program/booking/itinerary action-state matrix; refund/advance/collection/payment mapping to Billing/Treasury/orchestration; Platform Core attachments; profitability/accounting drill-down composition without duplicate truth.

Phase 1 remains incomplete. Comprehensive Phase 2 CI must not start yet.
