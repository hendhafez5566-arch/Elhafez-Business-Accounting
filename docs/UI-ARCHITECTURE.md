# ELHAFEZ UI ARCHITECTURE

Status: **Owner-authorized development policy — flexible presentation for every section**

## Purpose and ownership

Every section can change its whole visual composition without recreating business
ownership, persistence, financial rules or authorization. This supersedes the UI-02
blanket bans on page CSS, native controls and element-local styles. It applies to
Customers, Suppliers, Accounting, Hajj/Umrah, Tourism, Administration, Reports and
future sections equally. This policy change itself redesigns no production page.

Business truth stays in `modules/<owner>` and its public contracts. Browser
presentation stays in `apps/web/src`. A section may colocate components/styles in
`features/<section>/`, or beside an existing page; relocating all pages is unnecessary.
Shared controls/tokens/navigation remain reusable in `ui/`, `ui.tsx`, `styles.css`
and `app-shell.tsx`. A new presentation never justifies another balance, invoice,
capacity owner or persistence path.

## Freedom during construction

A redesign may replace tables with cards, change forms/columns, introduce drawers,
change internal navigation and replace obsolete page composition. Keep one active
route owner. Do not overlay a second implementation on the old page.

Shared primitives are preferred when they fit, not required templates. Semantic
native controls and section-owned components are permitted; preserve labels,
keyboard/focus behavior, validation, accessibility, RTL and responsive behavior.
Use element-local dynamic React styles when useful. Never inject global selectors
or use presentation to bypass validation, authorization or business ownership.
Use shared design tokens where appropriate without forcing the same layout.

No page is required to reproduce `ui-page-stack`, Card/DataGrid, the existing filter
grid or a fixed header arrangement merely because an earlier page used it.

## Isolated stylesheet contract

Import a colocated `*.module.css` file as a class map. TypeScript support lives in
`apps/web/src/css-modules.d.ts`. The production esbuild bundler generates distinct
class names, even when two sections both use a class called `layout`.

```tsx
import styles from './customers.module.css';
export function CustomerLayout() {
  return <section className={styles.layout}>...</section>;
}
```

The architecture gate allows CSS Modules and continues rejecting new unscoped page
CSS. Each comma-separated selector must start with a local class; nested selectors
start with `&` beneath a scoped rule. Conditional containers and keyframes work.

```css
.layout { display: grid; grid-template-columns: 18rem 1fr; }
.layout :is(button, input) { font: inherit; }
.layout { &[data-active='yes'] { opacity: 1; } }
@media (max-width: 700px) { .layout { display: block; } }
```

No `:global`, composition from global or `@import` escape hatches. Bare html/body,
`:root` and universal selectors do not belong in section files. Shared fonts,
resets and themes stay in the explicit global foundation. Its current canonical
CSS files remain `styles.css` and `ui/design-tokens.css`; this change deletes neither.

## Protected does not mean frozen

Shared shell/routes/primitives/tokens retain protection against accidental changes
for local field tasks. A complete or cross-section redesign MAY change them: declare
necessary paths and reason in the change manifest and test the shared behavior.
Never interpret protection as a prohibition on the owner's requested design.

Design approval establishes a baseline, not permanent immutability. A later explicit
redesign updates its visual baseline/tests. Business/isolation/validation tests
remain enforced; do not weaken assertions merely to make CI green.

## Existing shared defaults

Premium/classic themes, RTL shell, mobile drawer, fixed/compact/auto sidebar,
typography and density remain reusable defaults. Sections can use different
compositions under the same theme. Themes must not own business behavior.
Preferences remain behind the typed `ui/preferences.tsx` boundary.

## Acceptance of later redesigns

1. Define the full reference, page/interaction scope and viewport sizes.
2. Inspect route owner, API clients, validation and existing functionality.
3. Replace composition with scoped styles and suitable components.
4. Keep permissions, data contracts, financial sources and one route owner.
5. Test interactions/keyboard/RTL/responsiveness and compare actual browser renders
   with the reference. Typecheck alone is not visual acceptance.
6. Report differences; recoloring is not structural replacement.
7. Run change-safety, integrity, lint, typecheck, architecture and test gates.

## Executable regression evidence

`apps/web/src/ui-presentation-policy.spec.ts` executes the actual checker against
isolated repository fixtures: different layouts and controls are allowed, global
leakage is rejected, and domain/UI boundaries remain enforced. It also bundles
identically named CSS classes from two sections through esbuild to prove isolation.
The ordinary web test command discovers these tests; no optional gate is required.
