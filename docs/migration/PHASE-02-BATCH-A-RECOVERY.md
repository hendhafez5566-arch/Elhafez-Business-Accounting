# Phase 02 — Batch A Recovery Closure

Base commit: `52d1af320bf369572802800497d83cbba6791910`

## Canonical owners retained

### CRM
- Leads / follow-ups: `apps/web/src/crm-lead-followup-parity-pages.tsx`
- Customers / customer workspace: `apps/web/src/crm-party-pages.tsx`
- Customer 360: `apps/web/src/crm-360-parity-pages.tsx`
- Agents / agent 360 / commissions: `apps/web/src/crm-agent-parity-pages.tsx`
- Quotations: `apps/web/src/quotation-pages.tsx`
- Donor inspected: PR #97 / `feature/crm-full-legacy-parity`

### Tourism Services
- Canonical service lifecycle: `apps/web/src/tourism-services-page.tsx`
- Service 360 and documents remain their existing route owners.
- Donor inspected: PR #104 / `integration/procurement-tourism-latest-main` and `feature/procurement-tourism-full-legacy-parity`

### Procurement / Suppliers
- Suppliers: `apps/web/src/supplier-pages.tsx`
- Purchase orders / fulfillment / supplier-invoice conversion: `apps/web/src/procurement-pages.tsx`
- Supplier documents / intelligence remain their existing route owners.
- Donor inspected: PR #104 / `integration/procurement-tourism-latest-main` and `feature/procurement-tourism-full-legacy-parity`

## Recovery decision

The Phase 1 base already contains the previously recovered Batch A canonical implementations and later in-place structural work. Re-merging donor branches would reintroduce older architecture and is therefore rejected. Batch A keeps the current owners and adds regression coverage for the legacy-visible controls instead of creating V2 pages, mirrors, wrappers, hidden legacy screens, or parallel business logic.

## BLOCKED-BY-BACKEND

`Purchase Order -> optional Umrah program` remains blocked. The current `CreatePurchaseOrderInput` / `UpdatePurchaseOrderInput` contracts do not expose `programId`; therefore no fake selector persistence, hardcoded success, localStorage, or side-channel backend was added. Required contract: an owner-approved optional program reference on the canonical Procurement purchase-order aggregate/API, including read + create/update propagation.

## Target-contract notes

Supplier financial truth already exists through the supplier intelligence read model and remains owned by Billing/Treasury. Tourism finance/inventory truth remains owned by the existing Tourism/Accounting contracts. CRM financial actions continue routing to the canonical financial-action owner instead of duplicating invoice/receipt logic inside CRM.
