# CS-03 — Final CRM Integration

## Scope and ownership

CS-03 closes the current CRM & Sales program without creating duplicate business truth. `traveler-management` is the canonical company-scoped owner of traveler identity and travel-document history. Existing CS-01 owners remain canonical for Party, Customer, Agent, Lead and Follow-up state. `quotations` remains the quotation owner and is extended only with append-only outbound communication/export evidence. Customer 360, Agent 360 and the CRM dashboard are API/UI read compositions in the application composition root; they own no tables.

## Traveler Management

Traveler records are company-scoped and are accessed only from an authorized company/branch execution context. A Traveler may optionally reference canonical Customer/Party IDs without duplicating Party identity. Passport numbers are normalized and unique within a company. Document replacement preserves the prior document as historical evidence and links it to its superseding document. Archived Travelers cannot receive new documents.

The legacy Customer passport import boundary accepts normalized legacy records with stable source identity. Replay is idempotent by company + source system + source reference + payload fingerprint. Conflicting replay, invalid Customer/Party linkage, multiple matching Travelers, and passport collisions return explicit conflict/review outcomes instead of guessed links. Migration provenance is durable in `tvm_legacy_import_records`; AC-14 accounting migration remains untouched.

## Customer 360 and Agent 360

Customer 360 composes Customer/Party identity, converted Leads, Follow-ups, Quotations, linked Travelers, and quotation-linked Billing positions only through public application services. The financial section is explicitly limited to invoices produced from linked quotations; it is not presented as the customer’s complete accounting balance. Those snapshots are currency-separated and derived from Billing `getOpenPosition`; CRM owns no balance, receivable or invoice truth.

Agent 360 composes the canonical Agent profile, Customers assigned to that Agent, referred Leads and related Quotations. Agent commission terms shown there are commercial defaults only; financial commission recognition remains Accounting-owned.

## CRM dashboard and attention

The CRM dashboard derives counts and attention lists from owner reads: Lead stages, overdue Follow-ups, Quotation statuses, pending approvals, accepted quotations awaiting conversion, unresolved Lead-origin Customer linkage and quotations approaching expiry. Quotation values are never combined across currencies. No duplicate notification or reporting truth is stored.

## Quotation communication, print and WhatsApp

`qt_communications` is an append-only quotation-owned evidence table. Every record points to the exact quotation revision and stores channel, actor, recipient snapshot where relevant, and a server-derived outcome. Supported channels are WhatsApp, PDF, Print and Share. The server records hand-off/export initiation only; it never claims provider delivery.

The web quotation surface supplies a local printable RTL view. Print/PDF uses the browser print dialog without a heavy document subsystem. WhatsApp uses a browser deep-link hand-off with a normalized recipient and concise quotation summary. Share uses the browser share capability or clipboard fallback. Each action records evidence before hand-off/export.

## Security and architecture

All new endpoints use the existing bearer session plus company/branch execution context and owner permissions. Traveler operations expose dedicated `traveler.read`, `traveler.manage`, `traveler.lifecycle` and `traveler.migrate` permissions. Quotation communication uses `crm.quotation.communicate`. Cross-module collaboration uses public package/application boundaries only; no new cross-module Prisma access is introduced. The lightweight Traveler package root is separated from `@elhafez/traveler-management/nest`.

## Persistence

CS-03 uses one additive migration: `20260920230000_cs03_final_crm_integration`. It creates `tvm_travelers`, `tvm_travel_documents`, `tvm_legacy_import_records`, and quotation-owned `qt_communications`. No accepted historical migration is edited.

## Acceptance coverage

Behavioral tests cover Traveler company isolation, permissions, linkage validation, passport normalization/duplicates, immutable document history, archive guards, idempotent/conflicting legacy import and ambiguous linkage. Quotation tests cover revision-pinned append-only communication evidence, server-owned outcomes, permissions and WhatsApp validation. API acceptance covers Traveler module registration, Customer/Agent 360 composition, Billing-only financial reads, dashboard attention and currency separation. Web acceptance covers route reachability and the final Traveler/360/dashboard/quotation communication surfaces.

Customer 360 financial snapshots require the dedicated `crm.customer.financial.read` permission in addition to the underlying CRM owner read permissions.
