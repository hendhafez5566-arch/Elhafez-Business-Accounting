# Procurement / Tourism Legacy Parity — Checkpoint 3

Date: 2026-09-29
Branch: `feature/procurement-tourism-full-legacy-parity`
Phase: 1 — IN PROGRESS

## Guardrails re-confirmed

- OLD `hendhafez5566-arch/Elhafez-Tourism-Offline` is functional/UI/UX reference only. No legacy implementation is copied.
- NEW architecture remains authoritative for ownership, public APIs/read models/orchestration, permissions/scopes/approvals, safe-delete and financial boundaries.
- Billing / Accounting / Treasury remain the financial owners. Contract/inventory records must not create parallel ledgers, receivables, payables or treasury state.
- No work is being started on a third section. No `main` changes, merge, Railway deploy or production deploy.
- Full CI is not triggered while Phase 1 remains incomplete.

## Literal OLD → NEW audit continued

### Hotel contract workflow

OLD reference exposes the following user-visible concepts:

- hotel name and short accommodation label;
- city;
- supplier selection;
- effective stay / departure dates;
- currency and board basis;
- room-type inventory for single/double/triple/quad/quint;
- base nightly rates per room type;
- dated seasonal inventory/rate overrides;
- cancellation policy;
- contract attachments.

NEW already has canonical supplier selection, contract effective dates, versioned terms, hotel inventory quantities and stop-sale/allocation capabilities. The remaining parity work must NOT turn the inventory module into a financial owner. Currency/rates/cost terms must be classified as commercial contract terms and consumed by the canonical procurement/cost/billing/accounting flows rather than creating payable/accounting state locally. Hotel identity also needs to use the canonical tourism/service owner/read model instead of free-text duplication where such an owner exists.

### Flight-block contract workflow

OLD reference exposes:

- block label and airline;
- supplier;
- outbound flight number, origin, destination and date/time;
- return flight number, origin, destination and date/time;
- total seats;
- cost per seat and currency;
- ticketing deadline;
- fare class and baggage;
- contract attachments.

NEW currently owns flight-block inventory as capacity and exposes canonical supplier linkage. The literal audit confirms that return-leg metadata, ticketing deadline, fare class and baggage are parity requirements, but their implementation must be added as contract/version terms or canonical inventory metadata without creating duplicate supplier, procurement-finance or accounting ownership. Cost-per-seat is a commercial input only; financial postings remain downstream with their canonical owners.

## Current implementation status observed on this branch

- Contract creation reads suppliers from Supplier Management and filters selection to `ACTIVE + APPROVED` suppliers.
- Allocation reads Tourism Programs through the existing read path and excludes `CLOSED/CANCELLED` programs.
- Contract amendments create versioned terms rather than mutating financial state.
- General tourism-service inventory already supports category, description, unit, service dates, capacity and optional release deadline.
- Hotel, flight, transport and visa inventory, availability, allocation/release and Stop Sale remain within the Tourism Contract Inventory owner.

## Next Phase-1 work

1. Implement the remaining hotel/flight commercial metadata through the existing contract/version and inventory boundaries; do not introduce a second contract or finance model.
2. Wire contract documents through Platform Core's canonical file/link capability rather than storing blobs or a duplicate attachment table in Tourism.
3. Complete the remaining literal OLD forms/workflow audit for transport, visa, services, supplier/procurement and payment/refund/advance/collection hand-offs.
4. Verify that every financial action composes through Procurement Finance / Billing / Accounting / Treasury and that no tourism/procurement screen owns ledger state.
5. Only after all Phase-1 rows are closed, move to GitHub-hosted `ubuntu-latest` Phase-2 verification and record actual workflow/test results.
