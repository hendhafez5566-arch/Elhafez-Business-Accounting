# Procurement / Tourism Legacy Parity — Checkpoint 4

Date: 2026-09-29
Branch: `feature/procurement-tourism-full-legacy-parity`
Phase: 1 — **IMPLEMENTATION COMPLETE — UNVERIFIED**

This checkpoint supersedes Checkpoint 3 as the active hand-off point.

## Phase 1 closure

The requested implementation batch for **Purchases & Suppliers** and **Tourism & Services** is closed at code level. OLD was used only as functional/UI/UX evidence. NEW architecture remains authoritative.

### Purchases & Suppliers closed

- Supplier profile/lifecycle/approval/banks remain in Supplier Management + Party Registry.
- Supplier 360 composes evaluation, disputes/holds, Procurement, Fulfillment, Billing and Treasury reads.
- Invoice outstanding/overdue is derived from Billing open-position truth; no supplier balance field/store was created.
- Supplier advances are read from Billing using Treasury evidence.
- Purchase returns use Procurement Fulfillment correction; no return ledger/table was introduced.
- Supplier documents use Platform Core `EntityFileLinksApplicationService` with `SUPPLIER` entity links.
- Financial operations navigate/compose through Accounting/Billing/Treasury owners.

### Tourism & Services closed

- Standalone services, fulfillment and vouchers reuse their existing canonical owners.
- Tourism Service 360 composes operational + financial reads and does not store a second profitability/balance truth.
- Service documents use Platform Core file links.
- General tourism programs/bookings/itinerary reuse existing owners and lifecycle rules.
- Booking create uses canonical customer/traveler selectors.
- Booking confirmation uses canonical contract/resource catalog selectors.
- Allocation IDs are generated internally; the normal confirmation form does not ask users for an allocation ID.
- Flight/Visa confirmation requires operational evidence references.
- Booking cost center is selected from active CostBudgetAccounting-owned cost centers through a read adapter; users no longer enter an opaque cost-center ID in the normal confirmation form.
- Contract Inventory owns contracts/capacity/availability/allocation/release/stop-sale.
- Hotel/flight/transport/visa/service commercial parity metadata is stored as versioned contract terms, never as payable/accounting truth.
- Dated hotel room-rate amendments use their own effective period.
- Contract documents are linked directly to `TOURISM_CONTRACT` through Platform Core.
- The canonical supplier selected on a contract is the provider Party/Supplier identity. Hotel/flight/vehicle/service labels remain operational references and do not create duplicate identities.
- Hajj/Umrah specialized readiness remains with `hajj-umrah-readiness`; no competing general-tourism readiness store was created.

## Route / duplicate-owner closure

- Canonical Tourism route: `/tourism/contracts-inventory`.
- `/hajj-umrah/contracts-inventory` intentionally renders the same shared component/owner; it is not a second contract implementation.
- Supplier/service contextual document routes reuse one shared document UI and Platform Core storage.
- No second supplier ledger, tourism ledger, contract repository, file store, generic-service inventory owner or Party registry was introduced.
- No new database migration was required for this Phase 1 batch.

## Infrastructure / deployment closure

- `main` was not modified.
- Railway/proxy/domain/production configuration was not modified.
- No deployment was performed.
- No PR is opened yet; PR remains after verification.

## Explicit Phase 1 non-results

The following have **not** been executed and no passing claim is made:

- TypeScript / typecheck
- lint
- unit tests
- integration/API tests
- permission/branch-scope tests
- architecture checks
- Prisma generate / migration verification
- web/API build
- hosted CI workflow
- `pnpm verify`

## Phase 2 hand-off

Phase 2 is **NOT STARTED**. When the user explicitly starts it, begin with targeted verification for the changed owners/adapters/UI, fix failures, and run the comprehensive hosted/final verification only after targeted issues are resolved. Do not deploy or merge as part of verification unless separately requested.
