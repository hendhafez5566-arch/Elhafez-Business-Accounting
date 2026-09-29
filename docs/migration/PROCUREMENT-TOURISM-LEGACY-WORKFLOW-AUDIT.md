# Procurement + Tourism Literal Workflow Audit

This audit supports `PROCUREMENT-TOURISM-LEGACY-PARITY-EXECUTION.md`. OLD is functional/UI/UX reference only; no legacy implementation code is transferred.

## Phase 1 status

**CLOSED — IMPLEMENTATION COMPLETE / UNVERIFIED**

The remaining focused OLD forms, operations and workflow evidence were reviewed and mapped before closing Phase 1. Testing and runtime verification are intentionally deferred to Phase 2.

## Program/readiness evidence

OLD treated hotel, flight, transport, visa, meal, visit, guide, Rawda, insurance, health, camp and permit as configurable requirements and guarded Hajj/Umrah operational readiness using traveler, capacity, treasury and finance evidence.

NEW decision: do not create another readiness/task owner in general Tourism. `hajj-umrah-readiness` already composes the specialized Hajj/Umrah evidence. General Tourism keeps its canonical program/booking/itinerary lifecycle, while shared `tourism-contract-inventory` evidence remains reusable. Traveler/passport truth stays in `traveler-management`.

## Contract and inventory workflow evidence

Literal OLD contract forms were re-checked for hotel, flight, transport, visa and contracted service behavior.

- Hotel: supplier, period, room inventory, base rates, seasonal rate periods, cancellation policy and attachments.
- Flight: supplier, outbound/return segments, seats, commercial seat cost/currency, ticket deadline, fare class, baggage and attachments.
- Transport: provider/supplier, route, vehicle type/count/capacity, period, commercial cost/currency and attachments.
- Visa: supplier, service label, quota, period, processing days, commercial cost/currency and attachments.
- Contracted services: supplier, category, period, unit, quota/capacity and commercial unit cost.

NEW implementation keeps capacity/allocation/availability/stop-sale in `tourism-contract-inventory`. Commercial/descriptive details are versioned contract terms. Transport/visa and dated hotel-rate metadata now have an explicit structured amendment UI over the same contract owner. Contract attachments now link the `TOURISM_CONTRACT` entity directly to Platform Core files.

## Identity decision

OLD forms sometimes carried both a supplier and a free-text provider/carrier/hotel label. In NEW, the financially accountable organization is the canonical Supplier Management / Party Registry identity selected on the contract. Resource labels such as hotel reference, vehicle reference, flight number or carrier label remain operational/descriptive references only and do not create Party or Supplier records.

OLD quick-create supplier buttons are intentionally not reproduced inside contract forms. Supplier creation/resolution stays in Supplier Management so duplicate Party/Supplier identities are not introduced.

## Booking and allocation workflow

OLD used contextual selection and guarded resource assignment. NEW now:

- selects real customers/travelers from canonical CRM/traveler owners;
- selects contract/resource inventory from the Contract Inventory catalog;
- generates allocation IDs internally rather than asking the user to invent them;
- requires real flight-segment / visa-batch evidence for those allocation types;
- retains direct allocation ID only as an administrative lookup/release aid after allocation.

## Procurement / finance boundary

The final hand-off review confirms the following owner boundaries:

- supplier commitment / purchase order: procurement owners;
- supplier invoice/open payable/advance: Billing;
- payment/voucher/cash-bank settlement: Treasury / Accounting;
- customer invoice/open receivable: Billing;
- collection: existing Billing/Treasury party orchestration;
- customer/agent advance refund: Billing/Treasury/Financial Controls orchestration;
- tourism profitability: derived read from canonical sale/cost evidence, not stored again in Tourism.

No tourism contract, service, supplier page or read model owns a second ledger, receivable, payable, advance or treasury balance.

## Safe lifecycle / audit decision

Historical supplier, PO, booking, service, allocation and financial records are retained through their existing lifecycle/correction/cancellation mechanisms. No hard-delete path was introduced to replace canonical close/cancel/correct behavior. File deletion detaches the entity link through Platform Core rather than deleting a second copy held by Tourism or Supplier Management.

## Routes and duplicate owners

The target-section routes resolve to NEW canonical owners. The Hajj/Umrah contract-inventory route intentionally reuses the exact shared Tourism Contract Inventory component and owner; it is not a duplicate implementation. No second generic-service inventory form, second contract repository or legacy route-backed persistence was introduced.

## Phase 2 boundary

No TypeScript check, lint, unit/integration test, Prisma verification, build, hosted CI or `pnpm verify` result is claimed here. Those checks begin only when Phase 2 is explicitly started.
