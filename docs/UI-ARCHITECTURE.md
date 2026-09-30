# El-Hafez UI Architecture

This document defines the canonical structure and governance of the El-Hafez tenant web application's user interface.

## Core Principles

### Theme vs. Structure

- **Theme** = visual presentation only: colors, typography, shadow depth, border radius, density, spacing scale, icon libraries.
- **Screen Blueprint** = structural composition: grid layouts, split panes, master-detail, kanban columns, steppers, matrix tables, trees, directory listings, settings rails, entity-360 panes, workflows, dashboards, reports.

A screen is **not** considered redesigned merely because colors, buttons, or card styling changed. Completion requires the internal layout to match its reference blueprint or the master-module baseline.

### No Wrapper-on-Wrapper Layouts

The canonical page composition is the source of truth. Structural redesigns must:
1. Modify the canonical business page composition itself.
2. Export reusable structural primitives from the shared UI library if needed.
3. **Never** wrap an obsolete layout with a new layout.
4. **Never** add another wrapper above or below the canonical boundary.
5. Remove the obsolete container and code before merging.

### Route-to-Design Contract

Every registered route **MUST** declare an explicit `ScreenDesign` containing:
- A structural `blueprint` (one of the 15 families).
- A `reference` ID (one of the 39 owner-defined references).

This contract is enforced at route definition time. Invalid designs cause startup failure.

## Screen Structure Architecture

### Canonical Library Location

- **Module**: `apps/web/src/ui/screen-layouts.tsx`
- **Exports**: `ScreenBlueprint`, `ScreenReferenceId`, `SCREEN_BLUEPRINTS`, `SCREEN_REFERENCE_IDS`, `ScreenDesign`, `isScreenDesign()`, `ScreenLayoutBoundary`, `SplitWorkspace`, `MasterDetailWorkspace`, `SettingsWorkspace`, `WorkspacePane`.
- **Facade**: `apps/web/src/ui.tsx`

### Structural Blueprint Families (15)

| Blueprint | Purpose |
|-----------|---------|
| `dashboard` | Executive summary with metrics, KPIs, and status overview. |
| `module` | Generic module container; used when no more specific blueprint fits. |
| `directory` | Directory listing (table or card grid) with filtering and search. |
| `master-detail` | Primary list (master) with detail pane/drawer on the right; responsive to single column. |
| `entity-360` | Complete entity profile: tabs, sections, timelines, relationships, documents. |
| `workflow` | Step-by-step process: tasks, approvals, transitions, status tracking. |
| `kanban` | Columns with draggable cards; swimlanes or grouped columns. |
| `split` | Two equal or weighted columns; both panes equally important. |
| `settings` | Navigation rail (left/inline) + content area; subsections and toggle forms. |
| `tree` | Hierarchical navigation and content; expandable nodes. |
| `stepper` | Linear multi-step form or wizard with step indicators. |
| `transaction` | Single record entry or ledger transaction; date, amount, account, memo fields. |
| `matrix` | Multi-dimensional table (rows × columns × data); pivot tables, allocations, inventory. |
| `documents` | Document listing, upload, preview, versioning. |
| `reporting` | Report builder, filters, result table, export. |

### Screen Reference IDs (39 Owner-Defined)

```
fleet-transport                 — Transport, vehicles, drivers, trip assignments.
team-task-workflow             — Generic workflow: tasks, approvals, status tracking.
customer-management            — Customer directory, contact, classification, financial position.
trip-operations                — Kanban: trip tasks, readiness, assignments, incidents.
tourism-bookings               — Workflow: booking creation, validation, confirmation, payment.
supplier-disputes              — Supplier disputes and issue resolution workflow.
tourism-contracts              — Contract management: terms, renewal, attachments.
company-system-settings        — System settings: company data, branches, numbering, fields.
bank-reconciliation            — Bank statement matching and reconciliation workflow.
account-statement              — Account ledger, transactions, aging, status.
agents-commissions             — Agent directory and commission tracking.
currency-fx                    — Currency exchange rates and forex transactions.
cost-centers-budgets           — Cost center management and budget allocation.
vat-tax-returns                — VAT and tax return filing and tracking.
purchase-orders                — Purchase order creation, approval, receipt, invoicing.
audit-trail                    — Audit log and change history viewing.
chart-of-accounts              — Chart of accounts structure and GL hierarchy.
billing-invoicing              — Invoice generation, issuance, payment tracking.
master-module                  — Service definitions, offerings, capacity, pricing.
hr-payroll                     — Payroll processing, salary, deductions, reports.
voucher-ticketing              — Voucher and ticket issuance and redemption.
assets-depreciation            — Fixed asset register and depreciation schedules.
tourism-inventory-matrix       — Multi-dimensional hotel, transport, activity allocation.
crm-lead-pipeline              — Kanban: leads by stage, probability, value, conversion.
rooming-allocation             — Matrix: guest rooms × occupants × dates.
saas-control-plane             — Tenant/subscription management and monitoring.
treasury-settlement            — Cash and settlement management, bank transfers.
document-management            — Document repository, versioning, metadata, search.
system-administration          — System admin panels: users, roles, audit, logs.
tourism-itinerary-builder      — Workflow: daily itinerary planning, activities, timing.
financial-reporting            — Reports: P&L, balance sheet, trial balance, custom.
supplier-intelligence          — Entity-360: supplier profile, performance, contracts, disputes.
hajj-umrah-kanban              — Kanban: programs, bookings, readiness by status.
main-dashboard                 — Executive dashboard: KPIs, alerts, key metrics.
journal-entry                  — Accounting: journal entry creation and posting.
quotation-stepper              — Stepper: quotation creation, line items, approval, conversion.
app-layout                     — Shell layout, navigation, branding, responsive.
data-table                     — Reusable data table component and display patterns.
atoms                          — Design system atoms: buttons, inputs, icons, badges, colors.
```

### Route-to-Design Mapping

| Route Path | Blueprint | Reference | Purpose |
|-----------|-----------|-----------|---------|
| `/` | dashboard | main-dashboard | Executive summary. |
| `/management/exceptions` | workflow | team-task-workflow | Task workflow. |
| `/management/approvals` | workflow | team-task-workflow | Approval workflow. |
| `/management/reports` | reporting | financial-reporting | Report center. |
| `/management/outputs` | documents | document-management | Document outputs. |
| `/notifications` | directory | data-table | Notification list. |
| `/system-administration` | settings | system-administration | Settings panel. |
| `/system-administration/custom-fields` | settings | company-system-settings | Custom field configuration. |
| `/system-administration/document-numbering` | settings | company-system-settings | Document numbering setup. |
| `/system-administration/automation` | workflow | team-task-workflow | Automation rules. |
| `/crm/dashboard` | dashboard | main-dashboard | CRM dashboard. |
| `/crm/leads` | kanban | crm-lead-pipeline | Lead pipeline. |
| `/crm/followups` | workflow | team-task-workflow | Follow-up tasks. |
| `/crm/customers` | directory | customer-management | Customer list. |
| `/crm/customer-360` | entity-360 | customer-management | Customer profile. |
| `/crm/customer-documents` | documents | document-management | Customer documents. |
| `/crm/financial-action` | transaction | account-statement | Financial transaction. |
| `/crm/agents` | directory | agents-commissions | Agent list. |
| `/crm/agent-360` | entity-360 | agents-commissions | Agent profile. |
| `/crm/agent-documents` | documents | document-management | Agent documents. |
| `/crm/quotations` | stepper | quotation-stepper | Quotation creation. |
| `/crm/travelers` | directory | data-table | Traveler list. |
| `/procurement/suppliers` | directory | supplier-intelligence | Supplier list. |
| `/procurement/supplier-documents` | documents | document-management | Supplier documents. |
| `/procurement/supplier-intelligence` | entity-360 | supplier-intelligence | Supplier profile. |
| `/procurement/sourcing` | workflow | purchase-orders | PO workflow. |
| `/procurement/purchase-orders` | workflow | purchase-orders | Purchase orders. |
| `/procurement/returns` | workflow | purchase-orders | Return orders. |
| `/tourism/services` | directory | master-module | Service catalog. |
| `/tourism/service-360` | entity-360 | master-module | Service profile. |
| `/tourism/service-documents` | documents | document-management | Service documents. |
| `/tourism/programs` | workflow | master-module | Program management. |
| `/tourism/bookings` | workflow | tourism-bookings | Tourism bookings. |
| `/tourism/itinerary` | workflow | tourism-itinerary-builder | Itinerary planning. |
| `/tourism/contracts-inventory` | matrix | tourism-inventory-matrix | Contract allocation. |
| `/accounting` | dashboard | financial-reporting | Accounting workspace. |
| `/hajj-umrah/seasons` | directory | master-module | Season list. |
| `/hajj-umrah/contracts-inventory` | matrix | tourism-inventory-matrix | Contract allocation. |
| `/hajj-umrah/programs` | kanban | hajj-umrah-kanban | Program kanban. |
| `/hajj-umrah/program-workspace` | master-detail | hajj-umrah-kanban | Program detail workspace. |
| `/hajj-umrah/bookings` | workflow | hajj-umrah-kanban | Booking workflow. |
| `/hajj-umrah/rooming` | matrix | rooming-allocation | Room allocation matrix. |
| `/hajj-umrah/visas` | workflow | hajj-umrah-kanban | Visa workflow. |
| `/hajj-umrah/ticketing` | workflow | voucher-ticketing | Ticketing workflow. |
| `/hajj-umrah/transport` | workflow | fleet-transport | Transport workflow. |
| `/hajj-umrah/trip-operations` | kanban | trip-operations | Trip operations kanban. |
| `/hajj-umrah/readiness` | dashboard | hajj-umrah-kanban | Readiness dashboard. |
| `/hajj-umrah/barcode` | module | master-module | Barcode module. |
| `/settings/appearance` | settings | company-system-settings | Appearance settings. |
| `/settings/account` | settings | company-system-settings | Account settings. |

## Implementation

### ScreenLayoutBoundary Component

The canonical structural boundary for all routes. It **replaces** the existing `ui-page-stack` div, not adds above or below it.

**Location**: `apps/web/src/ui/screen-layouts.tsx`

```tsx
<ScreenLayoutBoundary design={active.design} key={sessionKey}>
  {children ?? active.element}
</ScreenLayoutBoundary>
```

Renders:
- `.ui-page-stack` — the structural container itself
- `.ui-screen-layout` — layout system marker
- `.ui-screen-layout--{blueprint}` — blueprint family class
- `data-screen-blueprint` — observable attribute
- `data-screen-reference` — observable attribute

Zero extra nesting. Content flows directly into the boundary.

### Reusable Workspace Patterns

Four reusable structural patterns available in `apps/web/src/ui/screen-layouts.tsx`:

1. **SplitWorkspace**: Two equal or weighted columns.
   ```tsx
   <SplitWorkspace left={<LeftPane />} right={<RightPane />} />
   ```

2. **MasterDetailWorkspace**: List (master) + detail pane.
   ```tsx
   <MasterDetailWorkspace master={<List />} detail={<Detail />} />
   ```

3. **SettingsWorkspace**: Navigation rail + content.
   ```tsx
   <SettingsWorkspace navigation={<Nav />} content={<Content />} />
   ```

4. **WorkspacePane**: Single structural pane.
   ```tsx
   <WorkspacePane variant="primary">{content}</WorkspacePane>
   ```

All patterns:
- Own structure only, **no business state, APIs, or data access**.
- **No theme colors or inline styles**.
- Export through the canonical `ui.tsx` facade.

## Governance

### Change Rules

- **New business pages**: Must declare a `ScreenDesign` in routes.tsx. Use an existing blueprint + reference if the structure matches; do not invent new blueprints or references.
- **Structural redesign of a page**: Replace the canonical page composition with a new layout matching the reference blueprint. Remove the old code. Update the reference if needed (owner sign-off required).
- **Theme-only changes** (colors, buttons, cards): Do not update the design metadata. Apply through CSS or theme provider.
- **New references**: Owner approval only. Add to `SCREEN_REFERENCE_IDS` in screen-layouts.tsx and this document.

### Testing

- **routes.spec.ts**: All foundation routes must have valid explicit designs. Specific mapping tests for `/`, `/crm/leads`, `/accounting`, `/system-administration`, `/hajj-umrah/rooming`.
- **screen-layouts.spec.tsx**: ScreenLayoutBoundary renders one canonical boundary with correct classes and attributes. Workspace patterns render expected structure.
- **app-shell-contract.spec.ts**: AppShell route renders correct blueprint/reference data attributes.

### Styling

- **Location**: `apps/web/src/styles.css`, baseline section under "SCREEN LAYOUT ARCHITECTURE".
- **Classes**: `.ui-workspace-split`, `.ui-workspace-master-detail`, `.ui-workspace-settings`, `.ui-workspace-pane`.
- **Theme-specific**: None. Use design tokens only; no hard-coded colors.
- **Responsive**: Stack single-column at ≤900px.

## Change Manifest

This architecture is tracked in `.changes/20260930-gemini-pro-full-ui-redesign.json`.
- **Type**: architecture
- **Affected paths**: `apps/web/src/**`, `docs/UI-ARCHITECTURE.md`
- **Protected paths**: `apps/web/src/app-shell.tsx`, `apps/web/src/styles.css`, `apps/web/src/ui/**`
- **Purpose**: Prevent future theme-only redesigns and patch-on-patch layouts; establish a clean structural gate before business screen migration.