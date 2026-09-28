# ELHAFEZ UI ARCHITECTURE

Status: **UI-02 — canonical foundation applied across application pages**

## Purpose

The web interface is a design system, not a collection of page-specific styling patches.
Business modules own business truth. The UI foundation owns reusable presentation primitives,
layout, navigation behavior, design tokens, accessibility conventions and personal presentation
preferences.

## Canonical locations

- `apps/web/src/ui.tsx` — stable public facade used by existing web pages.
- `apps/web/src/ui/primitives.tsx` — reusable controls and content primitives.
- `apps/web/src/ui/icons.tsx` — shared icon vocabulary.
- `apps/web/src/ui/navigation.tsx` — sidebar/topbar/navigation composition.
- `apps/web/src/ui/preferences.tsx` — typed presentation preferences and persistence adapter.
- `apps/web/src/ui/design-tokens.css` — colors, typography, density, spacing, radius, shadows and layout tokens.
- `apps/web/src/ui/themes/elhafez-premium.css` — optional premium presentation layer, gated by `data-ui-theme="premium"`.
- `apps/web/src/styles.css` — canonical shell/component rules consuming the design tokens.
- `apps/web/src/app-shell.tsx` — one application shell for every route.

## Rules for future work

1. A business page must consume shared UI components through `apps/web/src/ui.tsx`.
2. Do not create a second Button, Input, Table, Card, Tabs, Badge, Dialog, Drawer, Toast, PageHeader or FormSection when the shared primitive can represent the behavior.
3. Do not place inline `style={{...}}` declarations in application TSX.
4. Do not add page/module CSS files under `apps/web/src`. Reusable patterns belong in the central UI foundation.
5. New global colors, spacing, typography, breakpoints, radii or shadows must be introduced as design tokens, never as scattered literals.
6. A suite/menu is presentation only. Styling must never move or duplicate business ownership.
7. The shell remains RTL-first and responsive. The sidebar is physically on the right for desktop layouts.
8. Accessibility behavior is part of the component contract: keyboard focus, labels, dialog semantics and mobile drawer behavior must remain intact.
9. Global UI foundation paths are protected by Change Safety and CODEOWNERS. Local feature work must not edit them as a workaround.
10. When a genuinely reusable visual pattern is missing, add it once to the UI foundation with tests, then consume it from business pages.

## Replaceable visual themes

The canonical functional baseline remains `apps/web/src/styles.css`. A visual theme may only refine presentation on top of that baseline and must never own business behavior, data access, routing, validation or workflow logic.

The current theme registry is intentionally small:

- `premium` — the ELHAFEZ premium commercial appearance and the default for new/unauthenticated entry.
- `classic` — the canonical UI-02 baseline with no premium overrides.

Theme selection is part of `UiPreferences` and is applied through `html[data-ui-theme]`. The premium stylesheet is fully scoped under `html[data-ui-theme='premium']`, so selecting `classic` immediately disables the premium layer without changing application code or data.

The theme can therefore be evaluated or removed safely:

1. For an immediate user-level rollback, select **الشكل الأساسي** from **المظهر والتنقل**.
2. For a product-wide rollback, change the default `theme` in `DEFAULT_UI_PREFERENCES` to `classic`.
3. For complete removal, delete `apps/web/src/ui/themes/elhafez-premium.css`, remove its single import from `apps/web/src/index.tsx`, and remove the `premium` registry option. No business module should require changes.

Rules for future themes:

- Keep each optional visual theme inside `apps/web/src/ui/themes/`.
- Gate every theme rule behind its own `data-ui-theme` value.
- Style the existing shell/primitives; do not duplicate components or create theme-specific business pages.
- Keep the login/tenant-entry surface on the same shared controls and tokens as the authenticated application.
- Do not make a theme a prerequisite for layout correctness, accessibility or functional behavior; the `classic` baseline must remain usable on its own.

## Sidebar modes

The shell owns exactly three persisted presentation modes:

- `fixed`: full sidebar remains visible.
- `compact`: icon-only sidebar remains visible.
- `auto`: compact by default and expands on pointer hover or keyboard focus without shifting the content area.

Mobile navigation remains a drawer and does not depend on the desktop mode.

## Typography and density

The initial font registry is deliberately local and dependency-free:

- Tahoma
- system UI
- Arial

Adding a bundled/web font later is a registry/token change, not a page-by-page rewrite.

Font scale is one of `small | normal | large | xlarge`.
Density is one of `comfortable | balanced | compact`.
Pages must use rem/token-based sizing so these settings propagate consistently.

## Preference persistence

Presentation preferences are stored behind a typed adapter and namespaced by a `preferenceScope`.
The shell currently defaults to a local browser scope. When authenticated user identity is wired
into the app entry, pass the stable user ID as `preferenceScope`; no component or storage format
rewrite is required. A future cross-device preference service can implement the same typed boundary
without changing pages.

## Extension procedure

When adding a new UI requirement:

1. Decide whether it is page-specific content or reusable presentation behavior.
2. If reusable, extend the canonical primitive/pattern/token.
3. Add focused behavior/accessibility tests.
4. Use the new capability from the page through the public UI facade.
5. Run Change Safety, typecheck, lint, architecture check and web tests.
6. Do not create parallel styling paths.

This keeps future additions additive, discoverable and replaceable without patch-on-patch work.


## UI-02 application contract

UI-02 applies the foundation to the existing application without changing business ownership or business behavior.

- The App Shell renders the canonical page header for every registered route.
- Business pages render content inside the shared page stack; they do not create competing top-level page titles.
- Existing forms, cards, filters, tables, metrics and administration tools use the shared primitives and central CSS patterns.
- Application pages may use semantic `form`, `label`, `section` and `fieldset` elements, but interactive form controls must come from the shared UI facade.
- Raw `button`, `input`, `select` and `textarea` elements in application pages are rejected by the architecture gate.
- Dashboard metrics use the reusable `MetricCard` pattern; action rows use `ActionBar`; filters use the canonical grid pattern.
- Print-only document styling remains isolated to the printable document flow and is not an application-page styling escape hatch.

A future business module should therefore add business content only. It inherits the shell, page header, typography, density, responsive behavior and control styling without creating another visual foundation.
