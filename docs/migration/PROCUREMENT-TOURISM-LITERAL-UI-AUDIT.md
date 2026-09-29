# Procurement + Tourism Literal Legacy UI Audit

Phase 1 evidence ledger for `feature/procurement-tourism-full-legacy-parity`. OLD is functional/UI/UX evidence only; NEW ownership and public module boundaries remain authoritative.

## Audit result

**CLOSED FOR PHASE 1 — IMPLEMENTATION UNVERIFIED**

The focused OLD screens/workflows for the two target sections were re-read against the NEW branch. Missing behavior was implemented only at existing canonical owners. Nothing in this document is a test result; verification is Phase 2.

## Purchases & Suppliers

Literal OLD behavior reviewed across supplier/party controls and procurement workflows included supplier profile/contact/category, supplier selection, approval/lifecycle, purchase requests and orders, receiving/corrections, supplier financial visibility, documents and contextual navigation.

NEW mapping is now closed as follows:

- supplier identity/profile/lifecycle: `supplier-management` + `party-registry`;
- sourcing: `procurement-sourcing`;
- PO commitment/economics: `procurement-finance`;
- receiving/correction/purchase-return behavior: `procurement-fulfillment`;
- supplier invoice/open balance/advance: Billing;
- payment/voucher/cash-bank evidence: Treasury;
- supplier documents: Platform Core `EntityFileLinksApplicationService` with `SUPPLIER` entity links;
- evaluation/disputes/holds: their existing supplier owners;
- Supplier 360 reads the owners above and does not persist balances or payable truth.

Quick-create supplier behavior from OLD is intentionally not duplicated inside tourism contract forms. The NEW contract workspace selects an existing approved supplier so duplicate Party/Supplier identities are not created from a second feature.

## Tourism contract workspace

Reviewed OLD `src/core/umrah/forms.ts`, `src/core/umrah/operations.ts`, contract/inventory UI and workflow evidence.

### Picker behavior

OLD used contextual pickers rather than asking normal users for opaque internal IDs. NEW now uses canonical supplier/program/contract/resource/customer/traveler selectors. Allocation IDs are generated internally; direct allocation ID entry is retained only as an explicitly administrative lookup/release aid after allocation.

### Hotel contracts

OLD exposed hotel/short label, city, supplier, period, currency, board basis, room quantities/rates, dated seasonal overrides, cancellation policy and attachments.

NEW mapping:

- supplier/provider identity comes from Supplier Management / Party Registry;
- hotel/room references are operational resource references under the selected supplier, not new Party identities;
- quantities/availability/allocations remain in Tourism Contract Inventory;
- base commercial terms and room rates are versioned contract terms;
- dated seasonal room rates are saved as an additional version with its own effective period;
- contract attachments link the `TOURISM_CONTRACT` entity to Platform Core files;
- no hotel contract action creates payable, payment, ledger or treasury truth.

### Flight blocks

OLD exposed block label, airline label, supplier, outbound/return flight details, seats, cost/currency, ticketing deadline, fare class, baggage and attachments.

NEW mapping:

- the financially accountable provider is the selected canonical supplier;
- flight number/route/carrier label are operational/commercial references, not Party creation;
- outbound capacity and real flight-segment allocation evidence remain with inventory/booking owners;
- return leg, ticketing deadline, fare class, baggage and commercial pricing are versioned contract terms;
- attachments link directly to the canonical contract;
- payment/payable/profitability truth stays downstream in procurement/Billing/Accounting/Treasury.

### Transport contracts

OLD exposed transport company, supplier, route, vehicle type/count/capacity, contract period, total commercial cost/currency and attachments.

NEW mapping:

- the transport company/provider identity is the selected canonical supplier; no free-text provider creates another identity;
- transport capacity and period remain canonical inventory data;
- route, vehicle type/count/capacity-per-vehicle and commercial pricing can be recorded as versioned contract terms without becoming accounting truth;
- contract documents use Platform Core entity file links.

### Visa agreements

OLD exposed service label, supplier, period, quota, cost/currency, expected processing days and attachments.

NEW mapping:

- supplier identity is canonical;
- quota/effective period are inventory truth;
- service label, expected processing days and commercial price/currency are versioned terms;
- program-type requirements specific to Hajj/Umrah remain with the existing Hajj/Umrah program/readiness owners rather than being duplicated in general tourism contract storage;
- documents attach to the canonical contract.

### Contracted generic services

OLD supported camp/meal/visit/guide/Rawda/insurance and other allocatable services with supplier, period, unit, capacity/quota and commercial cost.

NEW mapping:

- `tourism-contract-inventory` generic service inventory owns category/name/description/unit/service period/capacity/release deadline;
- supplier is the contract's canonical supplier;
- optional commercial price is a versioned term only;
- the duplicate generic-service corrective form was removed; the primary contract workspace is the normal creation path.

## Tourism operations / finance hand-offs

Literal OLD booking/program/itinerary and finance cues were compared with NEW owners.

- Programs and itinerary use existing general-tourism owners and lifecycle rules.
- Booking creation uses canonical customer/traveler selectors.
- Booking confirmation uses contract/resource catalog selectors; internal allocation IDs are not user input.
- Flight/Visa allocations require real operational evidence references.
- Collection uses the existing customer party Billing/Treasury orchestration.
- Customer/agent advance refund uses existing Billing/Treasury/Financial Controls orchestration.
- Supplier settlement goes to canonical Accounting/Treasury rather than a tourism payment model.
- Tourism Service 360 composes operational and financial reads and does not persist a second balance/profitability record.

## Readiness decision

OLD Hajj/Umrah readiness behavior was not copied into general Tourism. NEW already has a dedicated `hajj-umrah-readiness` owner that composes traveler/inventory/finance evidence. Creating another mutable readiness/task store in Tourism would duplicate ownership. General Tourism keeps its existing program/booking lifecycle while shared inventory evidence remains reusable by the specialized readiness owner.

## Routes / duplicate UI decision

The target sections use their canonical NEW routes. `/hajj-umrah/contracts-inventory` intentionally renders the same shared Tourism Contract Inventory owner; it is not a second repository, service, table or data truth and is outside the target-section navigation cleanup.

No legacy persistence route, duplicate file store, supplier balance store, tourism payable store, second contract owner or second generic-service inventory owner was introduced.

## Phase boundary

Phase 1 code implementation and literal parity mapping are closed. TypeScript, build, lint, tests, permission verification, CI and `pnpm verify` have **not** been run and remain Phase 2 only.
