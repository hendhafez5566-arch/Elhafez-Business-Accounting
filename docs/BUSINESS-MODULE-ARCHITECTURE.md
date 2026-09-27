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
| Seasons | `hajj-umrah-seasons` | EXISTING / MERGED | seasons, date windows, season lifecycle |
| Programs | `hajj-umrah-programs` | EXISTING / MERGED | program templates/versions/lifecycle/readiness prerequisites |
| Bookings | `hajj-umrah-bookings` | EXISTING / MERGED | booking lifecycle, holds, confirmation/cancellation request state |
| Travelers | `traveler-management` | EXISTING / SHARED | traveler profile, passport/travel-document operational data |
| Contracts / Allotment / Inventory | `tourism-contract-inventory` | EXISTING / SHARED | contracts, capacity, allotments, allocations, stop-sale, inventory history |
| Rooming / Accommodation | `hajj-umrah-rooming` | EXISTING / MERGED | room assignment/rooming lists; references canonical hotel inventory |
| Visa operations | `hajj-umrah-visa-operations` | EXISTING / MERGED | visa batches/items/operational status; references visa supply/quota |
| Flight / Ticketing | `hajj-umrah-ticketing` | EXISTING / MERGED | ticket issuance/manifest/deadlines; references flight inventory |
| Transport operations | `hajj-umrah-transport-operations` | EXISTING / MERGED | buses/runs/assignments/routes; references transport capacity |
| Trip operations | `hajj-umrah-trip-operations` | EXISTING / MERGED | trip tasks, execution, incidents, operational checklists |
| Readiness | `hajj-umrah-readiness` | EXISTING / MERGED | aggregate operational readiness projection/orchestration |
| Egyptian Umrah Barcode | `hajj-umrah-barcode` | PLANNED / UI SHELL | future Egypt-specific Umrah barcode request/status/evidence lifecycle. The current web page is presentation-only and owns no business data; financial effects must stay with accepted accounting owners. |

Financial effects from these modules are delegated to accepted accounting owners, especially `tourism-finance-orchestration`, Billing, Treasury, Cost, Procurement Finance, and Financial Controls. Operational modules must not reproduce financial truth.

### B. Tourism & Services

| Visible area | Canonical code owner | Status | Ownership |
|---|---|---|---|
| Tourism programs / trips | `tourism-programs` | IMPLEMENTED / PR #82 CANDIDATE | general-tourism trip/program lifecycle |
| Tourism bookings | `tourism-bookings` | IMPLEMENTED / PR #82 CANDIDATE | individual/group tourism booking lifecycle |
| Travelers | `traveler-management` | EXISTING / SHARED | shared traveler identity/travel profile |
| Daily itinerary | `tourism-itineraries` | IMPLEMENTED / PR #82 CANDIDATE | days, activities, schedule |
| Contracts / supply / capacity | `tourism-contract-inventory` | EXISTING / SHARED | hotel/flight/transport/visa/service supply and allocation |
| Standalone services | `standalone-services` | EXISTING / MERGED | hotel/flight/visa/transport/other standalone sale request |
| Vouchers | `service-vouchers` | EXISTING / MERGED | issued service vouchers/output lifecycle |
| Service fulfillment | `service-fulfillment` | EXISTING / MERGED | supplier confirmation/waiting/fulfillment operational state |

### C. CRM & Sales

| Visible area | Canonical code owner | Status | Ownership |
|---|---|---|---|
| Common party identity | `party-registry` | EXISTING / SHARED | person/organization identity, contacts, canonical party ID/roles |
| Customers | `customer-management` | EXISTING / MERGED | customer commercial profile/preferences/status; references party ID |
| Agents / delegates | `agent-management` | EXISTING / MERGED | agent operational profile/assignment/terms; financial commissions stay in accounting |
| Leads / opportunities | `crm-leads` | EXISTING / MERGED | lead/opportunity lifecycle and conversion |
| Follow-ups | `crm-followups` | EXISTING / MERGED | tasks/interactions/follow-up history |
| Quotations | `quotations` | EXISTING / MERGED | quotation lifecycle and conversion intent |

Customer balances, invoices, advances, commissions, netting and other financial truth remain in accepted accounting modules.

### D. Suppliers & Procurement

| Visible area | Canonical code owner | Status | Ownership |
|---|---|---|---|
| Common party identity | `party-registry` | EXISTING / SHARED | canonical supplier party identity |
| Suppliers | `supplier-management` | EXISTING / MERGED | supplier profile, approval-for-use, operational classification |
| Supplier commitments / Purchase Orders | `procurement-finance` | EXISTING | canonical commitments/PO financial-economic record and invoice conversion |
| Receiving / execution / fulfillment | `procurement-fulfillment` | EXISTING | operational receipt/service execution evidence referencing canonical PO |
| Supplier evaluation | `supplier-evaluation` | EXISTING / MERGED | evaluation scorecards/history |
| Supplier disputes | `supplier-disputes` | EXISTING / MERGED | dispute cases/notes/status |

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
| Work Center | API composition (`work-center` projection responsibility) | EXISTING / PROJECTION | rebuildable, non-persistent aggregation of actionable items from owner public APIs |
| Operational reports | `operational-reporting` | PLANNED / PROJECTION | rebuildable read models, never owner truth |
| Owner/management dashboard | web composition over reporting/work-center/financial-reporting | EXISTING UI | Arabic-first overview, filters and canonical-owner drill-down; no direct table reads across modules |
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

Administration features remain separate only when they acquire a distinct data/business lifecycle. Current/planned owners:

| Feature | Canonical owner / status |
|---|---|
| Custom fields | `custom-fields` — IMPLEMENTED / ERP PRODUCT COMPLETION |
| Document numbering policies | `document-numbering` — IMPLEMENTED / ERP PRODUCT COMPLETION |
| Automation / workflow rules, delayed actions, retries and escalations | `automation-workflow` — IMPLEMENTED / ERP PRODUCT COMPLETION |
| Import/export jobs and mappings | `data-exchange` — EXISTING / MERGED |
| Backup/support operational jobs | `platform-operations` — EXISTING / MERGED; production backup provider still requires deployment wiring |

Do not split an already accepted `platform-core` capability merely to match a menu item.

## 3.1 MC-SA completion record

Status: **CLOSED / ACCEPTED / MERGED**.

The Management & System Administration program is complete for the owner-approved scope:

- **MC-SA-01 — System Administration & Platform Operations:** CLOSED / ACCEPTED / MERGED.
- **MC-SA-02 — Management & Control + Final Integration:** CLOSED / ACCEPTED / MERGED.
- **MC-SA-03:** not planned or required for the accepted scope.

Final MC-SA-02 merge to `main`: PR #73, merge commit `70e5adf17471e64c3fc5ae65c304abfbd6809c2c`.

Future work must treat these phases as an accepted baseline. Do not restart, duplicate, or redesign them merely to add a feature. Extend the canonical owners and public boundaries defined in this document. Any genuinely new capability must be scoped as new work and must preserve the ownership and dependency rules above.

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

### `party-registry` — EXISTING / SHARED

This is the shared identity root for a person/organization that may have customer, supplier, agent, or other roles.

Role-specific modules own only role-specific operational fields. Accounting modules reference opaque party IDs and retain financial truth.

### `traveler-management` — EXISTING / SHARED

This owns reusable traveler/passport/travel-profile operational data and may be surfaced in both Hajj & Umrah and Tourism suites.

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
9. add UI routes without moving ownership into the UI/composition root;
10. declare `dataScope`, any `branchScopedTables`, and explicit `criticalInvariants` in `module.json` so AE-01 can reject an unscoped new owner.

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

## MC-SA-01 finalized administration boundaries

`data-exchange` is the canonical owner of scoped import/export job metadata, mappings, validation and row outcomes; imported business records remain owned and written through target-owner public APIs. `platform-operations` is the canonical owner of backup/restore/verification and diagnostic evidence and uses infrastructure provider ports rather than business-table access. Commercial licensing, custom fields and global numbering are not part of either owner.


## SaaS commercial control plane — SAAS-01

Owner decision: the commercial SaaS lifecycle is a distinct platform truth owned by `saas-control-plane`.

- `platform-core` continues to own users, company/branch lifecycle, tenant sessions, company-scoped roles/permissions and the platform audit foundation.
- `saas-control-plane` owns Company Codes, plans, paid subscriptions, renewal/payment evidence, subscription events, platform-owner identities/sessions and entitlement decisions.
- A Company Administrator is never a Platform Owner and cannot grant itself control-plane authority.
- Tenant business modules do not import `saas-control-plane`; the API composition root applies one central subscription gate before tenant controllers.
- `pc_companies.active` remains an administrative/emergency kill switch and is not commercial subscription state.
- Subscription expiry never deletes tenant data and is evaluated from server time.
- Existing business and accounting owners are not modified to implement local licensing checks.


## Final system closure note — 2026-09-25

Canonical implementation status labels above were refreshed during the owner-authorized closure audit. This status refresh does **not** declare product Go-Live. General-tourism `tourism-programs`, `tourism-bookings`, and `tourism-itineraries` are implemented in PR #82 as an unmerged candidate and are not accepted until the final closure gates pass; Egyptian Umrah Barcode remains a UI shell. Product/deployment closure blockers are tracked in `docs/FINAL-SYSTEM-CLOSURE-AUDIT.md`.


## ERP Product Completion — cross-cutting automation ownership

### `automation-workflow` — PLANNED / OWNER APPROVED

The platform-wide automation engine is a distinct orchestration owner. It owns workflow definitions, trigger subscriptions, condition/action orchestration state, delayed execution, retry policy, escalation state and execution evidence.

It does **not** own the business truth that caused a trigger. Domain modules publish approved events or expose public commands; the automation engine records only orchestration state and invokes public boundaries. It must never update another module's tables directly.

Notifications remain `platform-core` capability truth unless a separately approved communication-delivery owner is introduced. Financial approvals remain `financial-controls`; the Automation engine may wait for or react to approval results but may not duplicate approval truth.
