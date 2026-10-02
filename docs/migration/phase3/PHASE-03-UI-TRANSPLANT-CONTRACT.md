# PHASE 03 — CLEAN UI TRANSPLANT CONTRACT

Status: EXECUTION CONTRACT

## 1. Why this pivot exists

Earlier Phase 3 execution treated legacy migration as "make the current target UI look more legacy". That allowed route wrappers, generic workspace reuse and changed headers to be counted as progress even when the actual visible screen remained the target-system presentation.

That is no longer accepted.

The implementation model is now:

> LEGACY PRESENTATION BLUEPRINT + TARGET BACKEND / MODULE ARCHITECTURE

The legacy system is a source of presentation and workflow knowledge only. The target system remains the only source of backend, APIs, services, permissions, domain rules, persistence and business ownership.

## 2. What is transplanted

For every legacy-visible route, extract and reproduce the relevant visible experience:

- information architecture
- page composition
- section ordering
- tabs
- cards and KPI/filter strips
- visible labels
- field set and field ordering
- conditional fields
- tables and exact business columns
- row actions
- search/filter/sort behavior
- modals/dialogs/drawers
- status display
- totals and summaries
- empty/loading/error/disabled states
- print/share controls where supported
- RTL density, spacing and visual hierarchy

The implementation may use React and the target UI primitives. It does not need to preserve legacy HTML implementation details, class names, data access or event handlers.

## 3. What must NEVER be transplanted

Do not copy or recreate legacy backend/runtime behavior:

- legacy DB/data-store access
- legacy persistence code
- legacy accounting engine
- legacy services/business logic
- legacy authorization implementation
- legacy IDs or generated numbers
- localStorage business persistence
- direct SQL/data writes from UI
- duplicated API clients or alternate service owners
- copied financial calculations when a canonical target owner exists

If a legacy action has no valid target contract, keep the required visible affordance only when useful and report it as BLOCKED-BY-BACKEND. Never fake success.

## 4. One route = one active presentation

Every target route must have exactly one active presentation owner.

Forbidden:

- rendering the existing target workspace and placing legacy UI above it
- wrapper-over-wrapper migration
- V2/new/final/copy route implementations
- hiding old UI with CSS
- exporting a generic target section and merely placing a legacy header around it
- keeping two active page owners for the same route

A legacy-looking header around the same generic target content is NOT a transplant.

## 5. Reuse rules

Reuse is encouraged at the correct layer.

Allowed reuse:

- canonical target API clients
- hooks/data loaders
- permissions/capabilities
- target state transitions
- shared low-level UI primitives (Button, Input, Select, DataGrid, Dialog, Badge, etc.)
- reusable non-opinionated presentation primitives
- shared formatting helpers

Not sufficient as visual migration:

- reusing a whole generic workspace section whose composition does not match the legacy route
- reusing a target page shell that preserves the wrong information architecture
- a single generic component parameterized by route labels when the routes are visibly different in the legacy system

## 6. Governance and guardrails

The architecture guards remain enabled. Do not weaken or remove them.

Important interpretation:

> MINIMUM BLAST RADIUS does NOT mean MINIMUM VISUAL CHANGE.

Phase 3 explicitly authorizes broad presentation replacement across the documented business routes.

If route-owned presentation or styling is required, use the accepted pattern under:

`apps/web/src/pages/<route-id>/...`

and route-owned CSS under:

`apps/web/src/pages/<route-id>/*.css`

following `docs/UI-ARCHITECTURE.md`.

The Phase 3 change manifest must truthfully include every required presentation file. If a protected UI path genuinely must change, declare it in `protectedPaths` with a real `protectedReason`. Do not artificially narrow the manifest and then compromise the implementation to fit it.

## 7. Screen implementation workflow

For each route:

1. Locate the legacy presentation source and supporting form/action definitions.
2. Write a private screen inventory: title, tools, filters, tabs, sections, forms, table columns, row actions, states.
3. Map each visible action/data need to the canonical target API/module owner.
4. Build the route-owned React presentation from the legacy screen inventory.
5. Bind it to canonical target data/actions.
6. Do not import/copy legacy business logic.
7. Verify that the superseded target presentation is no longer rendered for that route.
8. Compare the rendered result against the legacy blueprint/video notes.
9. Run focused tests and repository gates.

## 8. Acceptance test per screen

A screen is MATCHED only when all are true:

- actual visible organization follows the legacy blueprint
- important controls/fields/tables/actions are present in the correct hierarchy
- real target data/actions are wired
- no obsolete target presentation renders underneath
- no duplicate owner/API/service/persistence path exists
- RTL/responsive behavior remains valid
- unsupported actions are explicitly blocked rather than simulated

Route existence, a changed heading, a regression test, or a generic target component do not prove visual completion.

## 9. Product direction for target-only features

The legacy visible information architecture is the desired primary user organization.

Target-only backend capabilities may remain available without being promoted into the primary visible workflow.

Do not delete valid target backend capabilities solely for visual parity. Instead:

- keep the backend capability intact
- expose it only when it fits the intended workflow
- use secondary/advanced access when appropriate
- avoid cluttering the legacy-visible navigation

## 10. Phase 1 preservation

Preserve the accepted Phase 1 shell unless a proven integration mismatch requires change:

- boot/auth/login/setup
- App Shell
- sidebar
- topbar
- Portal Home
- global modal/dialog/toast
- print shell

Business page replacement happens inside this accepted shell unless the route is explicitly authorized as full-bleed.

## 11. Current rejected attempt

PR #143 is intentionally not part of the accepted implementation. It changed Accounting route identity while still reusing the existing `AccountingSectionContent` presentation. That pattern must not be repeated.

## 12. Execution sequence

First prove the transplant model on Accounting & Finance because it is the clearest mismatch and the strongest product requirement.

After Accounting is visually and structurally accepted, apply the same transplant method to:

1. CRM / Customers / Sales
2. Tourism Services
3. Procurement / Suppliers
4. Hajj & Umrah
5. Reports / Control
6. Administration / Settings
7. Final global reconciliation

Do not infer completion from route counts. Inspect the actual page composition.
