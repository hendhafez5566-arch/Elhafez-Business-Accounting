# Business Platform Module Architecture

Status: **CANONICAL — OWNER APPROVED**

This document is the canonical post-AC-14 business architecture for the ELHAFEZ platform. It defines how visible product sections are separated from code/data ownership so future work stays modular, reusable, and safe.

## 1. Vocabulary

- **Suite / System**: a large product area visible to the user, such as Hajj & Umrah or CRM & Sales. A suite is a navigation/workspace concept, **not** one giant code module.
- **Module**: a bounded code/data owner under `modules/<name>`. A module owns its business rules, tables, migrations, application services, and public API.
- **Shared module**: one module whose public API may be consumed by more than one suite. Shared does not mean shared tables.
- **Projection / workspace**: a read/composition surface that may combine multiple owners but must not become source truth.
- **Capability**: a smaller feature that may live inside an existing module when it does not justify a separate data/business owner.

UI placement never changes code ownership. A module can appear in more than one suite without being duplicated.

## 2. Non-negotiable ownership rules

1. One business truth has exactly one canonical owner.
2. A module never writes another module's tables or repository.
3. Cross-module synchronous work uses the provider's package-root/public application API.
4. Async collaboration uses approved versioned contracts/events.
5. The compile-time dependency graph remains a DAG.
6. Domain code never imports another module, Prisma, Nest, HTTP, or UI.
7. A new UI page is not automatically a new module.
8. A new module is created only when it owns distinct business rules/data lifecycle.
9. Existing accepted modules are extended through their canonical public boundary; never recreate their truth in a new operational module.
10. Suite/navigation regrouping is presentation only and must not require moving canonical business data.

## 3. Canonical top-level suites

### A. Hajj & Umrah

This is a large operational system composed of independent modules.

| Visible area | Canonical code owner | Status | Ownership |
|---|---|---|---|
| Seasons | `hajj-umrah-seasons` | PLANNED | seasons, date windows, season lifecycle |
| Programs | `hajj-umrah-programs` | PLANNED | program templates/versions/lifecycle/readiness prerequisites |
| Bookings | `hajj-umrah-bookings` | PLANNED | booking lifecycle, holds, confirmation/cancellation request state |
| Travelers | `traveler-management` | PLANNED / SHARED | traveler profile, passport/travel-document operational data |
| Contracts / Allotment / Inventory | `tourism-contract-inventory` | EXISTING / SHARED | contracts, capacity, allotments, allocations, stop-sale, inventory history |
| Rooming / Accommodation | `hajj-umrah-rooming` | PLANNED | room assignment/rooming lists; references canonical hotel inventory |
| Visa operations | `hajj-umrah-visa-operations` | PLANNED | visa batches/items/operational status; references visa supply/quota |
| Flight / Ticketing | `hajj-umrah-ticketing` | PLANNED | ticket issuance/manifest/deadlines; references flight inventory |
| Transport operations | `hajj-umrah-transport-operations` | PLANNED | buses/runs/assignments/routes; references transport capacity |
| Trip operations | `hajj-umrah-trip-operations` | PLANNED | trip tasks, execution, incidents, operational checklists |
| Readiness | `hajj-umrah-readiness` | PLANNED | aggregate operational readiness projection/orchestration |

Financial effects from these modules are delegated to accepted accounting owners, especially `tourism-finance-orchestration`, Billing, Treasury, Cost, Procurement Finance, and Financial Controls. Operational modules must not reproduce financial truth.

### B. Tourism & Services

| Visible area | Canonical code owner | Status | Ownership |
|---|---|---|---|
| Tourism programs / trips | `tourism-programs` | PLANNED | general-tourism trip/program lifecycle |
| Tourism bookings | `tourism-bookings` | PLANNED | individual/group tourism booking lifecycle |
| Travelers | `traveler-management` | PLANNED / SHARED | shared traveler identity/travel profile |
| Daily itinerary | `tourism-itineraries` | PLANNED | days, activities, schedule |
| Contracts / supply / capacity | `tourism-contract-inventory` | EXISTING / SHARED | hotel/flight/transport/visa/service supply and allocation |
| Standalone services | `standalone-services` | PLANNED | hotel/flight/visa/transport/other standalone sale request |
| Vouchers | `service-vouchers` | PLANNED | issued service vouchers/output lifecycle |
| Service fulfillment | `service-fulfillment` | PLANNED | supplier confirmation/waiting/fulfillment operational state |

### C. CRM & Sales

| Visible area | Canonical code owner | Status | Ownership |
|---|---|---|---|
| Common party identity | `party-registry` | PLANNED / SHARED | person/organization identity, contacts, canonical party ID/roles |
| Customers | `customer-management` | PLANNED | customer commercial profile/preferences/status; references party ID |
| Agents / delegates | `agent-management` | PLANNED | agent operational profile/assignment/terms; financial commissions stay in accounting |
| Leads / opportunities | `crm-leads` | PLANNED | lead/opportunity lifecycle and conversion |
| Follow-ups | `crm-followups` | PLANNED | tasks/interactions/follow-up history |
| Quotations | `quotations` | PLANNED | quotation lifecycle and conversion intent |

Customer balances, invoices, advances, commissions, netting and other financial truth remain in accepted accounting modules.

### D. Suppliers & Procurement

| Visible area | Canonical code owner | Status | Ownership |
|---|---|---|---|
| Common party identity | `party-registry` | PLANNED / SHARED | canonical supplier party identity |
| Suppliers | `supplier-management` | PLANNED | supplier profile, approval-for-use, operational classification |
| Supplier commitments / Purchase Orders | `procurement-finance` | EXISTING | canonical commitments/PO financial-economic record and invoice conversion |
| Receiving / execution / fulfillment | `procurement-fulfillment` | PLANNED | operational receipt/service execution evidence referencing canonical PO |
| Supplier evaluation | `supplier-evaluation` | PLANNED | evaluation scorecards/history |
| Supplier disputes | `supplier-disputes` | PLANNED | dispute cases/notes/status |

**Do not create a second Purchase Order truth.** The existing `procurement-finance` owner is retained. New operational fulfillment references its public PO/commitment identity.

### E. Accounting & Finance

Status: **CLOSED / ACCEPTED / MERGED through AC-14.**

Existing accepted owners include:

`currency-fx`, `tax`, `cost-budget-accounting`, `period-control`, `general-ledger`, `financial-controls`, `billing-subledgers`, `treasury-settlement`, `party-accounting`, `expense-commission-recognition`, `assets-financing`, `procurement-finance`, `tourism-contract-inventory`, `tourism-finance-orchestration`, and `financial-reporting`.

Do not recreate accounting behavior inside operational modules. Extend/call these owners only through their public APIs.

### F. Management & Control

This suite is primarily composition/projection, not a second source of business truth.

| Visible area | Canonical owner | Status | Rule |
|---|---|---|---|
| Work Center | `work-center` | PLANNED / PROJECTION | aggregates actionable items from owner APIs/events |
| Operational reports | `operational-reporting` | PLANNED / PROJECTION | rebuildable read models, never owner truth |
| Owner/management dashboard | web composition over reporting/work-center/financial-reporting | PLANNED UI | no direct table reads across modules |
| Alerts | `platform-core` notifications + owner events | EXISTING FOUNDATION | alert display does not own source state |
| Approval Center | composition over approval owners | PLANNED UI | financial approvals remain `financial-controls`; generic approvals use platform capability when introduced |
| Activity/Audit | `platform-core` | EXISTING | audit history remains platform-owned |

### G. System Administration

The accepted `platform-core` remains the canonical owner for the existing generic platform capabilities:

- users;
- roles/permissions;
- companies;
- branches and user branch access;
- sessions;
- audit log;
- files;
- notifications;
- configuration;
- migration control.

Future administration features should remain separate only when they acquire a distinct data/business lifecycle. Candidate planned owners:

| Feature | Planned owner |
|---|---|
| Custom fields | `custom-fields` |
| Document numbering policies | `document-numbering` |
| Import/export jobs and mappings | `data-exchange` |
| Backup/support operational jobs | `platform-operations` |

Do not split an already accepted `platform-core` capability merely to match a menu item.

## 4. Shared reusable owners

### `tourism-contract-inventory` — EXISTING

This is the single canonical owner for tourism/Hajj/Umrah contract supply, allotment and capacity. It is displayed inside more than one suite but implemented once.

It owns, among other accepted concepts:
- contract versions/amendments;
- hotel inventory;
- flight blocks;
- transport capacity;
- visa quotas;
- stop-sale;
- allocations/releases;
- capacity/economic evidence.

Never create `hajj-allotment`, `umrah-inventory`, or `tourism-hotel-stock` as parallel source-truth modules.

### `party-registry` — PLANNED

This will be the shared identity root for a person/organization that may have customer, supplier, agent, or other roles.

Role-specific modules own only role-specific operational fields. Accounting modules reference opaque party IDs and retain financial truth.

### `traveler-management` — PLANNED

This will own reusable traveler/passport/travel-profile operational data and may be surfaced in both Hajj & Umrah and Tourism suites.

Program/booking-specific participation remains owned by the relevant booking/program module.

## 5. Cross-suite collaboration pattern

Example: Hajj/Umrah booking confirmation.

`hajj-umrah-bookings`
- owns booking state;
- references traveler IDs from `traveler-management`;
- requests/references capacity through `tourism-contract-inventory`;
- requests financial workflow through `tourism-finance-orchestration`;
- never writes Inventory, GL, Billing, Treasury, Procurement, or Traveler tables directly.

Example: supplier service fulfillment.

`procurement-fulfillment`
- references supplier ID from `supplier-management` / `party-registry`;
- references PO/commitment through `procurement-finance` public API;
- records operational fulfillment only;
- does not recreate supplier payable or invoice truth.

## 6. Module creation rule

When a PLANNED owner is implemented:

1. use the exact canonical package/directory name from this document unless the owner explicitly approves a rename;
2. create it from `modules/_template`;
3. complete `module.json`;
4. assign uniquely owned tables with a module-specific prefix;
5. expose only `src/public/index.ts`;
6. declare only required public dependencies;
7. add tests before registration;
8. register in `apps/api` only through the public Nest module;
9. add UI routes without moving ownership into the UI/composition root.

## 7. Existing-owner preservation

Accepted modules are not renamed, split, or duplicated merely to make the new product navigation look cleaner.

If a future feature appears to overlap an accepted owner:
- keep the accepted owner;
- add the missing public contract if genuinely required;
- place new operational state in the new owner only if it is a distinct truth;
- STOP for architecture review if ownership remains ambiguous.

## 8. Navigation is not architecture

The UI may later group or regroup modules without changing code ownership.

Examples:
- Allotment can appear under Hajj & Umrah and Tourism while remaining `tourism-contract-inventory`.
- Suppliers may appear in Procurement while supplier financial balances remain Accounting-owned.
- Customers may appear in CRM while invoices/receivables remain Billing-owned.
- Approval Center may aggregate decisions from several owners without becoming the owner of those decisions.

This separation is deliberate and is the basis for safe future modifications.
