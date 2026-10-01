# ELHAFEZ UI ARCHITECTURE

Status: **UI-05 — Replace, Not Overlay**

## Purpose

The web interface must support major page redesigns without repeating the failure mode of the legacy system: a new page being rendered on top of an old page, old wrappers remaining underneath new wrappers, or CSS hiding obsolete UI after it has already been rendered.

Business modules continue to own business truth. UI code owns presentation only. A redesign may radically change the appearance and composition of a route, but it must not create a second API path, business service, table, financial owner or source of truth.

The governing rule is:

> **Replace, not overlay. A route has one active presentation path.**

## Presentation layers

The UI architecture separates three concerns:

1. **Business behavior** — real APIs, permissions, state transitions and canonical module ownership.
2. **Route surface** — whether a route uses the normal ERP shell or owns a full-bleed surface.
3. **Page presentation** — the actual page composition and, when justified, route-owned styling.

These concerns must not be simulated through CSS tricks.

## Canonical locations

- `apps/web/src/ui.tsx` — stable public facade for reusable controls.
- `apps/web/src/ui/primitives.tsx` — reusable controls and content primitives.
- `apps/web/src/ui/screen-layouts.tsx` — reusable structural screen blueprints.
- `apps/web/src/ui/icons.tsx` — shared icon vocabulary.
- `apps/web/src/ui/navigation.tsx` — standard sidebar/topbar/navigation composition.
- `apps/web/src/ui/preferences.tsx` — typed presentation preferences.
- `apps/web/src/ui/design-tokens.css` — shared visual tokens.
- `apps/web/src/styles.css` — standard application shell and reusable component styling.
- `apps/web/src/app-shell.tsx` — chooses the route surface before rendering presentation chrome.
- `apps/web/src/route-surface.ts` — explicit route-surface registry.
- `apps/web/src/pages/<route-id>/*.css` — optional route-owned CSS for a page whose supplied design cannot be expressed cleanly through the standard shared styles.
- `apps/web/src/routes.tsx` — route registry and structural `ScreenDesign` declarations.

## Route surfaces

There are two route surfaces:

### `standard`

The normal ERP surface. `AppShell` renders the canonical Sidebar, mobile Drawer, Topbar, PageHeader and exactly one `ScreenLayoutBoundary`.

### `full-bleed`

A deliberate replacement surface for a route whose accepted design owns the full viewport. `AppShell` does **not** render Sidebar, Drawer, Topbar, PageHeader or the standard page-stack and then hide them. Those elements are never rendered for that route.

The route surface is chosen before rendering through `routeSurfaceFor(routeId)`. Unknown routes default to `standard`.

A full-bleed route is not an escape from business architecture. It changes presentation composition only.

## Route-owned page styling

Page-specific CSS is allowed only when it is a real page implementation, not a patch over another implementation.

Allowed location:

```text
apps/web/src/pages/<route-id>/*.css
```

Every route-owned stylesheet must declare its owner:

```css
/* page-style-owner: crm-customers */
```

Route-owned CSS may style the page's own classes. It may **not** style or hide global application structure.

Forbidden in route-owned CSS:

- `.app-shell`
- `.app-sidebar`
- `.app-topbar`
- `.app-main`
- `.app-content`
- `.app-route-surface`
- `.ui-page-stack`
- `html`, `body` or `:root` ownership
- `:has(...)` used to detect already-rendered layers and hide them

If a route needs a different shell, change the route surface. Do not render the old shell and conceal it with CSS.

Route-owned CSS must be imported by the page implementation that owns it. It must not be imported globally from the application entry point merely to force a page design to work.

## Non-negotiable anti-layering rules

1. One route has one active presentation implementation.
2. Do not render an obsolete shell/component and hide it with CSS.
3. Do not keep V1 active while V2 is placed above it.
4. Do not create `new`, `v2`, `final`, `copy`, or equivalent parallel implementations unless a temporary migration is explicit, tested and removes the superseded path before completion.
5. Replacing presentation must not duplicate API clients, services, workflows, database tables, financial ownership or state machines.
6. Shared controls such as Button, Input, Select and Textarea continue to come from `apps/web/src/ui.tsx` unless the canonical primitive itself is intentionally replaced centrally.
7. Inline `style={{...}}` application styling remains forbidden.
8. Inline `<style>` blocks are not a supported page-styling mechanism. CSP remains enabled; do not weaken security policy to make a page design work.
9. Page-owned CSS must remain scoped to the page and may not control the global shell.
10. Global design tokens and truly reusable visual patterns remain in the canonical UI foundation.
11. A redesign must delete or disconnect the superseded presentation path rather than layering around it.
12. Mock/localStorage prototype data must never replace production data ownership.

## Screen structure architecture

Every registered route still declares a `ScreenDesign`:

```ts
interface ScreenDesign {
  blueprint: ScreenBlueprint;
  reference: ScreenReferenceId;
}
```

For `standard` routes the App Shell consumes the design through one `ScreenLayoutBoundary`.

For `full-bleed` routes the design remains route metadata for testing, documentation and structural intent, while the accepted page implementation owns the viewport directly. The standard boundary is not rendered underneath it.

Canonical blueprint families remain deliberately small:

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

## The owner-supplied references

The supplied designs are implementation targets for presentation and structure, not sources of business truth. Their visual layout may be reproduced closely, including a route-specific visual identity, while real system data/actions remain connected to the existing backend.

For each supplied design:

1. Identify the exact target route.
2. Decide `standard` versus `full-bleed` before implementation.
3. Remove or disconnect the superseded presentation for that route.
4. Rebuild the accepted design using the existing real APIs and permissions.
5. If route-owned CSS is required, place it under `apps/web/src/pages/<route-id>/` and scope it to the page.
6. Never import prototype localStorage/seed behavior into production.
7. Test that obsolete shell/page layers are not present in the rendered output.

## Redesign acceptance rule

A redesign is complete only when all of the following are true:

1. The correct route renders the intended design.
2. The route surface is explicit and tested.
3. Superseded presentation layers are not rendered underneath the new page.
4. There is one styling source for the page presentation; no inline duplicate remains.
5. Existing real APIs, permissions and state transitions remain the source of behavior.
6. No duplicate business/data path was introduced.
7. Mobile and RTL behavior are verified.
8. Change Safety, Engineering Integrity, typecheck, lint, architecture check, tests and build pass.

## Architecture enforcement

`tools/architecture/check-architecture.ts` enforces the relevant rules fail-closed:

- only canonical global CSS and route-owned page CSS locations are accepted;
- route-owned CSS must declare its route owner;
- route-owned CSS cannot target global shell/document/page-stack selectors;
- route-owned CSS cannot use `:has()` as a shell-hiding workaround;
- raw application form controls remain prohibited outside the shared UI foundation;
- inline style objects remain prohibited;
- module/data ownership and dependency DAG checks remain unchanged.

The purpose of the guard is no longer to prevent pages from looking different. Its purpose is to prevent **stacked implementations, hidden obsolete layers and duplicated ownership**.

## Security boundary

CSP is a security control, not a visual-style policy. It remains enabled. A legitimate redesign must work through bundled application assets and normal React rendering without enabling unsafe inline style/script execution.

Do not weaken CSP to accommodate a template.

## Application contract

For a `standard` route:

- one canonical App Shell is rendered;
- one Sidebar/Topbar navigation composition is rendered;
- one PageHeader is rendered;
- one `ScreenLayoutBoundary` is rendered.

For a `full-bleed` route:

- the standard Sidebar/Topbar/PageHeader/page-stack are not rendered at all;
- the route page owns the viewport directly;
- route-owned CSS styles only that page;
- business ownership remains unchanged.

This is the permanent protection against the legacy failure mode: **a redesign replaces the old presentation instead of becoming another layer above it.**
