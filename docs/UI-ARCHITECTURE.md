# ELHAFEZ UI ARCHITECTURE

Status: **UI-04 — canonical theme + screen-layout separation**

## Purpose

The web interface is a design system, not a collection of page-specific styling patches.
Business modules own business truth. The UI foundation owns reusable presentation primitives,
layout, navigation behavior, design tokens, accessibility conventions and personal presentation
preferences.

The UI architecture has two independent presentation concerns:

1. **Visual theme** — colors, typography, density, radii, shadows and other appearance tokens.
2. **Screen layout blueprint** — the structural composition of a screen: dashboard, split view,
   master/detail, settings workspace, Kanban, matrix, form, stepper, timeline, documents,
   command center, operations workspace, profile or data table.

A theme is never allowed to stand in for a screen redesign. Changing the theme alone must not be
reported as changing a screen's structure.

## Canonical locations

- `apps/web/src/ui.tsx` — stable public facade used by existing web pages.
- `apps/web/src/ui/primitives.tsx` — reusable controls and content primitives.
- `apps/web/src/ui/screen-layouts.tsx` — canonical screen blueprint vocabulary and reusable structural workspaces.
- `apps/web/src/ui/icons.tsx` — shared icon vocabulary.
- `apps/web/src/ui/navigation.tsx` — sidebar/topbar/navigation composition.
- `apps/web/src/ui/preferences.tsx` — typed presentation preferences and persistence adapter.
- `apps/web/src/ui/design-tokens.css` — colors, typography, density, spacing, radius and shadows.
- `apps/web/src/styles.css` — canonical shell/component rules and visual-theme sections consuming design tokens.
- `apps/web/src/app-shell.tsx` — one application shell and one screen-layout boundary for every route.
- `apps/web/src/routes.tsx` — route registry; every route must declare its structural `ScreenDesign`.

## Non-negotiable anti-patching rules

1. A business page must consume shared UI components through `apps/web/src/ui.tsx`.
2. Do not create a second Button, Input, Table, Card, Tabs, Badge, Dialog, Drawer, Toast, PageHeader,
   FormSection, AppShell or page-stack implementation when the canonical implementation exists.
3. Do not place inline `style={{...}}` declarations in application TSX.
4. Do not add page/module CSS files under `apps/web/src`. Reusable patterns belong in the central UI foundation.
5. New global colors, spacing, typography, breakpoints, radii or shadows must be introduced as design tokens,
   never as scattered literals.
6. A suite/menu is presentation only. UI composition must never move or duplicate business ownership.
7. The shell remains RTL-first and responsive. The sidebar is physically on the right for desktop layouts.
8. Accessibility behavior is part of the component contract: keyboard focus, labels, dialog semantics and mobile drawer behavior must remain intact.
9. Global UI foundation paths are protected by Change Safety and CODEOWNERS. Local feature work must not edit them as a workaround.
10. When a genuinely reusable visual or structural pattern is missing, add it once to the canonical UI foundation with tests, then consume it from business pages.
11. Do not put a new wrapper around an obsolete wrapper. Replace the canonical path and remove superseded local duplication.
12. A redesign must not introduce a second data flow, API client, business service, table, financial owner or source of truth.

## Screen structure architecture

### `ScreenDesign`

Every registered route declares exactly one structural design:

```ts
interface ScreenDesign {
  blueprint: ScreenBlueprint;
  reference: ScreenReferenceId;
}
```

`defineRoutes()` validates this declaration fail-closed. A new route without a valid canonical
blueprint/reference is rejected before navigation can render it.

The App Shell reads the route design and renders **one** `ScreenLayoutBoundary`. This component
replaces the former bare `ui-page-stack`; it does not wrap another page stack. The root shell and
boundary expose `data-screen-blueprint` and `data-screen-reference` so tests and visual QA can prove
which structural specification is active.

### Canonical blueprint families

The canonical blueprint vocabulary is deliberately small and reusable:

- `dashboard`
- `module`
- `data-table`
- `master-detail`
- `split`
- `settings`
- `kanban`
- `matrix`
- `form`
- `stepper`
- `timeline`
- `documents`
- `command-center`
- `operations`
- `profile`

If a new screen appears to need a sixteenth family, first prove that none of these families can
represent it cleanly. Do not create page-specific layout abstractions merely to match one mockup.

### Structural workspaces

Reusable structural compositions belong in `ui/screen-layouts.tsx`. The initial canonical set is:

- `SplitWorkspace`
- `MasterDetailWorkspace`
- `SettingsWorkspace`
- `WorkspacePane`

They use the existing canonical Card/grid foundation. They do not own data, routing, business actions
or API calls. Business pages provide content and handlers; the structural component only composes them.

### The 39 owner-supplied references

The supplied references are registered as **screen structure specifications**, not as theme names:

1. Fleet & Transport Management
2. Team Task Workflow
3. Customer Management CRM
4. Trip Operations Dashboard
5. Tourism Bookings
6. Supplier Disputes
7. Tourism Contracts
8. Company & System Settings
9. Bank Reconciliation
10. Account Statement
11. Agents & Commissions
12. Currency & FX Management
13. Cost Centers & Budgets
14. VAT & Tax Returns
15. Purchase Orders
16. Audit Trail & Logs
17. Chart of Accounts
18. Billing & Invoicing
19. Master Module Template
20. HR & Payroll Module
21. Voucher & Ticketing Center
22. Assets & Depreciation
23. Tourism Inventory Matrix
24. CRM Lead Pipeline
25. Rooming Allocation
26. SaaS Control Plane
27. Treasury Settlement
28. Document Management
29. System Administration
30. Tourism Itinerary Builder
31. Financial Reporting Center
32. Supplier Intelligence
33. Hajj & Umrah Kanban Board
34. Main Dashboard
35. Journal Entry Form
36. Quotation Stepper
37. App Layout
38. Data Table
39. Design System Atoms

A route may reuse the closest canonical reference when no one-to-one reference exists, but the page
must still implement the appropriate structural blueprint. Reusing a reference never authorizes
copying mock data into source truth.

## Redesign acceptance rule

A screen is **not** considered redesigned merely because its colors, font, buttons, radius, cards or
spacing changed.

For a structural redesign to be accepted:

1. The route has a valid `ScreenDesign`.
2. The page composition matches its blueprint/reference intent (for example split view, Kanban,
   master/detail, settings navigation, matrix, stepper, transaction form or command center).
3. Existing real APIs, permissions, state transitions and owner modules remain the source of behavior.
4. Mock reference data is never introduced as business truth.
5. Mobile/RTL behavior is verified for the actual structure, not only for theme tokens.
6. Tests cover the route design contract and any reusable structural component.

## Replaceable visual themes

The canonical functional baseline remains the unscoped rules in `apps/web/src/styles.css`. A visual
theme may refine presentation on top of that baseline and must never own business behavior, data
access, routing, validation, workflow logic **or screen structure**.

Theme selection is part of `UiPreferences` and is applied through `html[data-ui-theme]`. A theme may
style the canonical shell/primitives/layouts, but must not create theme-specific business pages or a
parallel screen hierarchy.

Rules for future themes:

- Keep shared theme rules in the canonical styling path; do not create parallel page/module CSS files.
- Gate every optional theme rule behind its own `data-ui-theme` value.
- Style the existing shell/primitives/layouts; do not duplicate components.
- Keep the login/tenant-entry surface on the same shared controls and tokens as the authenticated application.
- Do not make a theme a prerequisite for layout correctness, accessibility or functional behavior.
- Never describe a theme-only change as a structural redesign.

## Sidebar modes

The shell owns exactly three persisted presentation modes:

- `fixed`: full sidebar remains visible.
- `compact`: icon-only sidebar remains visible.
- `auto`: compact by default and expands on pointer hover or keyboard focus without shifting the content area.

Mobile navigation remains a drawer and does not depend on the desktop mode.

## Typography and density

The font registry remains dependency-light and presentation-only. Font scale and density may change
spacing and type size, but they must not select a different screen blueprint.

Pages must use rem/token-based sizing so these settings propagate consistently.

## Preference persistence

Presentation preferences are stored behind a typed adapter and namespaced by a `preferenceScope`.
The shell currently defaults to a local browser scope. A future cross-device preference service can
implement the same typed boundary without changing pages or layout ownership.

## Extension procedure

When adding or redesigning a UI surface:

1. Identify the business owner(s); do not let the screen become a business owner.
2. Choose the canonical `ScreenBlueprint` and `ScreenReferenceId` in the route registry.
3. Decide whether the page can use existing structural workspaces.
4. If a reusable structural pattern is genuinely missing, extend `screen-layouts.tsx` once with tests.
5. Compose the page around existing real data/actions; do not create parallel API/data paths.
6. Add focused behavior/accessibility/structure tests.
7. Run Change Safety, Engineering Integrity, typecheck, lint, architecture check and web tests.
8. Inspect the final diff for wrapper-on-wrapper, duplicate primitives, duplicate services and unrelated styling churn.

## Application contract

- The App Shell renders the canonical page header for every registered route.
- The App Shell renders exactly one canonical `ScreenLayoutBoundary` for route content.
- Business pages do not create competing global shells or top-level page stacks.
- Interactive form controls come from the shared UI facade.
- Dashboard metrics use `MetricCard`; action rows use `ActionBar`; common tabular data uses `DataGrid` where appropriate.
- Structural layouts come from the route blueprint and canonical structural helpers, not from the active visual theme.
- Print-only document styling remains isolated to printable flows and is not an application-page styling escape hatch.
- UI composition does not change canonical module/data ownership.

This separation is the permanent protection against the repeated failure mode where a redesign only
recolors the old page structure. Future visual themes remain replaceable, while screen composition is
explicit, testable and independently evolvable without layering one UI architecture over another.
