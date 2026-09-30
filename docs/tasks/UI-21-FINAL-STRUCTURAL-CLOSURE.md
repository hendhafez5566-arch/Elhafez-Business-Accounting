# UI-21 Final Structural Closure — Codex Batch

## Goal
Finish the remaining structural UI redesign in ONE bounded batch on branch `ui-21-final-structural-closure-codex`, based on the current Preview head `62621e6888b1a5a7df72035cfd92426d762239a8`.

This is NOT a theme/color task. It is a structural screen-layout completion task.

## Non-negotiable architecture rules
1. One functional route = one canonical UI owner.
2. Redesign the existing canonical page IN PLACE.
3. Absolutely NO hidden `/manage` routes, old/new parallel pages, alternate UI owners, copied business logic, duplicate API clients, duplicate services, duplicate tables/models, or wrapper-on-wrapper composition.
4. Do NOT create page-specific CSS. Use existing canonical shared UI and `screen-layouts` primitives.
5. Do NOT change backend/API/database/domain ownership unless a compile-safe import/type adjustment is strictly required; this batch is UI architecture only.
6. Reuse existing state, API calls, commands, permissions, actions, business rules and transaction owners exactly once.
7. Remove obsolete local Tabs/page-stack shells when the registered route blueprint is not a tabs blueprint.
8. Do not weaken authentication/security or production rules.
9. Do not create any Railway/infra changes.
10. If a screen is already structurally compliant, do not rewrite it just to increase change count; lock it with a structural test instead.

## Required remaining screens

### 1) Supplier Intelligence
File: `apps/web/src/supplier-intelligence-page.tsx`

Current issue: tab-heavy profile (`summary / procurement / finance / quality / disputes`).

Target: canonical Supplier Intelligence profile/workspace with persistent supplier header/KPIs and structural navigation/master-detail style matching the registered `supplier-intelligence` reference.

Keep existing evaluations, procurement metrics, financials, disputes and holds logic unchanged.

### 2) System Administration
File: `apps/web/src/system-administration-page.tsx`

Current issue: legacy Tabs shell across users, roles, companies, branches, sessions, audit, files, notifications, company configuration, imports and diagnostics.

Target: canonical Settings/Admin workspace inside the SAME `SystemAdministrationPage` owner. Reuse the existing `AdministrationClient`, state and actions. No second page and no hidden route.

### 3) Reporting Center
File: `apps/web/src/reporting-center-page.tsx`

Current issue: tab-heavy shell (`executive / financial / parties / operations / saved`).

Target: canonical reporting workspace aligned to the `financial-reporting-center` reference. Preserve saved reports, schedules, financial statements, aging, treasury, tax, profitability and party statements from existing sources.

### 4) Platform Foundations
File: `apps/web/src/platform-foundations-page.tsx`

Routes already exist separately for custom fields, document numbering and automation. Do NOT create three business implementations.

Target: the SAME page owner renders a route-selected structural surface via `initialTab` (or renamed equivalent) without a local Tabs shell. Shared loading/state/actions remain centralized once.

### 5) Quotations
File: `apps/web/src/quotation-pages.tsx`

Registered route blueprint is `stepper` / `quotation-stepper` but the page still has legacy detail tabs (`overview / revisions / delivery / history`).

Target: real quotation stepper/workspace in the canonical page, preserving revisions, delivery/communication, approvals, conversion and history logic.

## Final whole-system structural audit
Audit every registered route in `apps/web/src/routes.tsx` against its declared `ScreenDesign`.

- No route may rely on theme-only styling where the internal structure contradicts its blueprint.
- No `/manage` mirror or parallel UI owner.
- No nested `ui-page-stack` page shell below the App Shell.
- No local `Tabs` acting as the primary screen shell when the blueprint is dashboard, command-center, kanban, profile, settings, master-detail, matrix, stepper, timeline, operations, documents or data-table.
- Preserve legitimate sub-tabs only if they are truly local content controls and do not replace the registered screen blueprint.
- Confirm mobile/RTL-safe composition using shared canonical primitives.

## Barcode note
`apps/web/src/hajj-umrah-barcode-page.tsx` is currently a functional placeholder. Do NOT invent barcode backend functionality. Only ensure its existing placeholder UI does not violate structural architecture.

## Required tests
Add/extend structural tests to fail if:

- `/manage` or similar hidden mirror routes are reintroduced.
- a second page owner is created for any functional route.
- the five target pages still use legacy primary Tabs shells.
- nested page-stack shells return.
- registered route blueprint/reference contracts are removed or bypassed.

## Governance
Before editing, read and obey:

- `AGENTS.md`
- `AI_CHANGE_PROTOCOL.md`
- `PROJECT_STATE.md`
- `docs/ARCHITECTURE.md`
- `docs/BUSINESS-MODULE-ARCHITECTURE.md`
- `docs/BUSINESS-MODULE-ROUTING.md`
- `docs/MODULE-STANDARD.md`
- `docs/TESTING-STANDARD.md`
- `docs/ARCHITECTURE-CONSTITUTION.md`
- `docs/UI-ARCHITECTURE.md`

Create exactly one change manifest for this batch under `.changes/` with only the actually changed UI/test/governance paths.

## Acceptance
Do not consider the task complete until the code passes:

- change-safety
- engineering-integrity
- prisma generate if CI requires it
- affected/full typecheck as configured by CI
- lint
- architecture check
- affected/full tests as configured by CI
- structural UI tests for this batch

Do NOT merge to `main`.

Target only the Preview branch after GitHub CI is fully green.

## Execution instructions for an offline Codex checkout
If the Codex environment has no Git remote, GitHub token, or network access, this file is the authoritative task specification. Do not attempt to fetch Issue #126. Work entirely from this document and the repository-local governance documents. Commit completed work locally on branch `ui-21-final-structural-closure-codex`. Do not invent requirements beyond this document and the repository rules.
