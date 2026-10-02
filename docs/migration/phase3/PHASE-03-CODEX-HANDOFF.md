# PHASE 3 — CODEX EXECUTION HANDOFF

## Mission

This is the final execution phase for the ELHAFEZ visual migration.

It is **not** a routing task, a parity audit, or a generic redesign. It is a **full internal visual replacement + final visual reconciliation** task.

Repository:
`hendhafez5566-arch/Elhafez-Business-Accounting`

Execution branch:
`phase3/full-internal-visual-replacement`

Base commit:
`7fb9483887a2b89ccdf0278e5ccda8ca81325044`

That base already contains merged Phase 1 and Phase 2.

## Why Phase 3 exists

Phase 1 successfully replaced the global shell. Phase 2 succeeded architecturally and functionally, but many business routes still render the newer generic target presentation instead of the old-system presentation.

Known example:
- `apps/web/src/accounting-legacy-routes.tsx` exposes legacy-visible accounting routes.
- `apps/web/src/accounting-legacy-route-page.tsx` still adapts those routes into the existing `AccountingWorkspaceView`.
- Therefore a route existing is **not evidence of visual migration**.

Apply these rules throughout the project:

- `ROUTE EXISTS != MIGRATED`
- `CI PASS != VISUAL MATCH`
- `CANONICAL OWNER EXISTS != LEGACY UI COMPLETE`
- A wrapper/adapter into an unmatched generic target page is `NOT MIGRATED` visually.

## Authority order

1. **Visual master notes** in `docs/migration/phase3/PHASE-03-LEGACY-VISUAL-NOTES.md`.
2. **Screen/interaction contract** in `docs/migration/phase3/PHASE-03-SCREEN-MATRIX.md`.
3. Current target code for all Backend/API/Service/Auth/Permissions/Domain/State/architecture ownership.
4. Prior PRs and branches are donor sources only; do not merge them wholesale.

The original visual reference available during preparation was `1000063326.mp4`. The larger `accounting-system-compressed-full.mp4` was referenced by the source contracts but was not available in the current file set, so do not claim certification against that missing file.

## Non-negotiable architecture rule

OLD behavior/presentation is the UI/UX/functional reference.

NEW system is the only source of truth for:
- APIs
- Services
- Auth
- Permissions
- Domain models
- Routing architecture
- Database
- Business logic
- State/persistence

Do not copy legacy backend or business logic into React.

If the target already has the operation, use the canonical target contract.
If the target lacks the operation, preserve the correct visible UI when appropriate and record `BLOCKED-BY-BACKEND` instead of creating fake persistence or duplicate services.

## Replace, never overlay

For each route or screen:

- inspect current target owner;
- replace the route-owned presentation in place or introduce one clean route-owned presentation component that consumes the existing canonical contracts;
- remove presentation that becomes dead because of the replacement;
- keep shared components that are still used elsewhere.

Forbidden:
- UI over UI
- hidden old/new screens
- V2 parallel pages
- `/manage` mirrors
- CSS that hides App Shell or old screens
- wrapper-over-wrapper as a migration substitute
- duplicate route owners
- duplicate services or business logic
- localStorage/sessionStorage as a backend substitute
- fake data or fake success
- hardcoded business IDs
- `any`, `ts-ignore`, disabled guards/tests
- wholesale copying of legacy `app.js` or `styles.css`

## Definition of a migrated screen

A screen is `MATCHED` only after its actual visible presentation has been reviewed and rebuilt/reconciled for:

- title/header/breadcrumb/subtitle
- cards/KPIs/status badges
- toolbar and primary/secondary actions
- tabs
- search/filter/sort/pagination
- form fields, field order, labels, placeholders, selects and conditional fields
- table columns and row actions
- menus/dropdowns/context actions
- modal/dialog/drawer layout and footer actions
- loading/empty/error/disabled states
- print/PDF/share/WhatsApp controls where part of the old visible flow
- RTL structure
- responsive behavior that exists in the reference
- colors, spacing, borders, radius, shadows, typography and density

Do **not** count a route as matched merely because a test can find its path or label.

## Required execution order — one task, one branch, one PR

### Wave 1
- CRM / Customers / Sales
- Tourism Services
- Procurement / Suppliers

### Wave 2
- Hajj & Umrah
- Finance / Accounting

### Wave 3
- Reports / Control
- Administration / Settings
- Global final reconciliation

These are internal checkpoints only. Do not create separate phase branches or PRs.

## Before editing each scope

Build a private per-route inventory:

`LEGACY VISIBLE SCREEN -> CURRENT TARGET SCREEN -> MATCHED / PARTIAL / NOT MIGRATED`

Then immediately implement the missing visual replacement. Do not stop and return an inventory report.

## Phase 1 shell

Phase 1 is already deployed and should not be redesigned from scratch.

Review only for proven visual mismatch:
- boot/loading/auth shell
- login
- first-run/setup
- sidebar
- topbar
- portal home
- workspace landing shell
- global search/dropdowns/notifications/user menu
- global modal/dialog pattern
- toast/confirmation
- print preview shell
- mobile drawer / RTL shell

If already matched, leave it alone.

## Known Phase 2 areas that require skepticism

Do not treat these as visually complete without inspecting the visible result:

- `apps/web/src/accounting-legacy-route-page.tsx`
- `apps/web/src/accounting-legacy-routes.tsx`
- `apps/web/src/hajj-umrah-dashboard-page.tsx`
- `apps/web/src/reports-control-legacy-pages.tsx`
- `apps/web/src/administration-legacy-pages.tsx`
- `apps/web/src/phase2-batch-c-routes.tsx`
- existing CRM/Tourism/Procurement canonical pages inherited from earlier parity PRs

Phase 2 route-registry and regression tests prove ownership/coverage, not pixel/interaction fidelity.

## Existing confirmed backend blockers from Phase 2

Keep these blocked unless a real target contract already exists when you inspect current code:

1. Procurement optional Umrah-program linkage: target `CreatePurchaseOrderInput` has no `programId`.
2. Tenant-admin backup create/verify/restore/backup-list operations are Owner-sensitive and MFA-protected, not tenant System Administration operations.
3. Legacy document archive metadata/workflow lacks target fields for record type/id, description, expiry, categories/groups and expiry workflow.
4. Legacy notification-threshold settings for passport/invoice/program/treasury alerts have no canonical tenant settings contract.
5. Legacy print-policy settings such as A4/A5, orientation, amount-in-words, signatures/footer lack a canonical tenant settings contract.
6. Unsupported report definitions such as cash-flow, sales-by-customer/agent, passport-expiry, service-profitability and FX-exposure must not be calculated in React if no target reporting contract exists.

## Target-contract exceptions already accepted

- Per-user payment approval limit / max discount / cost visibility remain owned by Approval policy and Platform Core RBAC rather than a copied legacy user model.
- Period Archiving can present administrative readiness/navigation, while financial period state/close remains owned by Accounting.
- Internal `/management/*` and `/system-administration/*` technical drill-down routes may remain routable but must not create duplicate business navigation.

## Final reconciliation

After all business screens are rebuilt:

1. Walk every route in the screen matrix.
2. Confirm exactly one active UI owner per route.
3. Remove obsolete route adapters where the final independent route presentation makes them unnecessary.
4. Remove dead route-owned presentation/components/styles/imports caused by replacement.
5. Do not remove shared pieces still used by another scope.
6. Re-check Phase 1 shell integration.
7. Re-check RTL, responsive behavior, forms, tables, dialogs, menus, loading/empty/error, and print shell.
8. Every visible action must either call a real target contract or be recorded as `BLOCKED-BY-BACKEND`.

## Quality gates

Run the complete repository gates required by the current project, including at least:

- Change Safety
- Engineering Integrity
- Prisma Generate
- Full Typecheck
- Lint
- Architecture Check
- Full Test Suite
- Build
- Replace-Not-Overlay / UI ownership guards

Do not weaken tests or guards to pass.

## Completion standard

Do not close Phase 3 unless all are true:

- every route in the screen matrix was reviewed at presentation level;
- every `NOT MIGRATED` primary business screen was actually rebuilt/reconciled;
- no major business page remains in the previous NEW-system visual layout unless the legacy reference is genuinely equivalent;
- ONE ACTIVE UI PER ROUTE;
- NO OLD TARGET UI LEFT UNDER IT;
- NO DUPLICATE SCREEN;
- NO PATCH LAYER;
- NO LEGACY BACKEND COPIED;
- TARGET ARCHITECTURE PRESERVED;
- VISUAL / INTERACTION COVERAGE COMPLETE to the best extent supported by the provided references;
- all quality gates pass.

## Final response only

Return a short final report:

`PASS` or `FAIL`

- Branch
- HEAD SHA
- PR
- legacy-visible routes/screens checked
- matched count
- remaining visual mismatches
- duplicate/legacy leftovers
- final `BLOCKED-BY-BACKEND`
- target-contract exceptions
- quality gates
- confirmation of ONE ACTIVE UI PER ROUTE / NO OVERLAY / NO DUPLICATE UI OWNER / NO LEGACY BACKEND COPIED / TARGET ARCHITECTURE PRESERVED

Do not merge the Phase 3 PR until administrative review approves it.