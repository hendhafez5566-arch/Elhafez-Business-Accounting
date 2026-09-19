# PROJECT MANAGER HANDOFF — ELHAFEZ BUSINESS ACCOUNTING

> This file is the permanent handoff entry point for a replacement ChatGPT/project-manager conversation.
> It is intentionally stored in the repository so project continuity does not depend on one chat session.

## 1. How a replacement manager must start

If the current manager chat is unavailable, the owner should tell the new manager:

> Open the GitHub repository `mhafez300300-byte/Elhafez-Business-Accounting`.
> Read `PROJECT_MANAGER_HANDOFF.md`, `PROJECT_STATE.md`, `AI_CHANGE_PROTOCOL.md`, `AGENTS.md`, and the accounting architecture documents before making any decision.
> Continue from the current verified repository state. Do not restart completed phases.

The replacement manager must **verify GitHub first**. Never trust this file blindly if the repository has moved forward. `PROJECT_STATE.md` is designed to be updated after every accepted phase merge.

## 2. Project identity

- Product: **ELHAFEZ BUSINESS ACCOUNTING**
- Repository: `mhafez300300-byte/Elhafez-Business-Accounting`
- GitHub is the **Source of Truth** for implementation, history, accepted merges, and CI.
- Product purpose: clean modular accounting for Hajj, Umrah, tourism and related service companies, with secure integration to tourism operations.
- Architecture: TypeScript monorepo, modular monolith, NestJS API, React web app, Prisma persistence.
- Primary languages/product direction: Arabic-first UI with English support.
- Commercial context: Egypt and Saudi Arabia, multi-company, multi-branch, multi-currency.

Legacy forensic reference used for accounting behavior:
- Repository: `mhafez300300-byte/Elhafez-Tourism-Offline`
- Frozen legacy commit: `e97fa6d9cb52acb22b676e1b975c1b2332bc9a13`
- Legacy version: `v32.5.66`
- The legacy repository is evidence/reference only. Do not copy its architecture into the new system.

## 3. Owner / manager working model

The owner is the product owner, not a professional programmer.

The manager must:
- manage sequence and scope;
- give the owner one clear next action;
- prepare exact copy/paste prompts for coding agents when needed;
- inspect GitHub code, diffs, migrations, tests and CI after publication;
- issue only `PASS`, `FIX REQUIRED`, or `BLOCKED` when a decision is needed;
- distinguish real blockers from non-critical observations;
- keep non-critical improvements in backlog rather than repeatedly reopening accepted work;
- never restart or redesign a completed phase without a proven blocker affecting runtime, data integrity, security, architecture, or an essential requirement;
- prevent scope bleed into later phases;
- keep GitHub as the implementation truth.

The owner prefers clean implementation over patches: **no patch-on-patch work**.

## 4. Non-negotiable architecture

Read these files before implementation:
- `docs/ARCHITECTURE.md`
- `docs/MODULE-STANDARD.md`
- `docs/TESTING-STANDARD.md`
- `docs/accounting/ACCOUNTING-ARCHITECTURE.md`
- `docs/accounting/ACCOUNTING-DEPENDENCY-GRAPH.md`
- `docs/accounting/ACCOUNTING-DATA-OWNERSHIP.md`
- `docs/accounting/ACCOUNTING-CONTRACTS-CATALOG.md`
- `docs/accounting/ACCOUNTING-BUILD-SEQUENCE.md`
- `docs/accounting/ACCOUNTING-AC00-COVERAGE-MATRIX.md`

Core rules:
1. Every business module owns its code, data lifecycle, tables and migrations.
2. A module may not read/write another module's tables or repositories.
3. Cross-module synchronous access is only through the provider's public package/application API.
4. Cross-module async collaboration uses approved shared contracts/events.
5. The compile-time/module import graph must remain a DAG.
6. `packages/core` and `packages/contracts` never depend on business modules.
7. Domain code does not import Prisma, Nest, HTTP, UI, or another module.
8. API is a composition root, not a business layer.
9. No core/shared architecture change may be used as a shortcut for a local module problem.
10. Posted/economic history is not erased. Corrections use explicit reversal, adjustment, amendment, or versioning.
11. Financial quantities use exact decimal semantics, not floating point.
12. State-changing financial workflows require durable idempotency and concurrency safety where races matter.
13. Company/branch isolation and server-side authorization are mandatory.
14. Financial Controls detects/authorizes; it must not silently mutate another owner's economic records.
15. Reporting consumes projections/read models and does not own source balances.

## 5. Phase workflow

Normal implementation flow:

1. Confirm current `main` and read `PROJECT_STATE.md`.
2. Create/use the canonical phase branch from the accepted main baseline.
3. Coding agent creates its own automatic working branch when its product does so.
4. Coding agent opens/publishes a PR into the phase branch.
5. Manager reviews:
   - scope;
   - changed files;
   - module ownership;
   - public boundaries;
   - Prisma schema/migrations;
   - actual source code, not only PR description;
   - tests;
   - CI steps/results.
6. If there is a real blocker: targeted `FIX REQUIRED`; do not restart the phase.
7. Merge reviewed implementation into the phase branch.
8. Run/verify phase CI.
9. Open phase branch → `main` PR.
10. Require final green CI.
11. Merge to `main`.
12. Update `PROJECT_STATE.md` in the same governance discipline before beginning the next phase.

Do not create unnecessary nested manual branches merely because the agent already creates an execution branch.

## 6. Quality gates

Repository standard:
- `pnpm install --frozen-lockfile`
- `pnpm prisma:generate`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm architecture:check`
- `pnpm test`
- `pnpm verify` when available/appropriate
- `git diff --check`

A green generic CI is necessary but not sufficient. Acceptance also requires inspection of the real implementation and phase-specific tests.

Never weaken lint, architecture gates, or test inclusion to make a phase appear green.

## 7. Accounting program history

The architecture/build sequence in the repository is authoritative. Current accepted sequence:

- Phase 00 — Architecture Foundation
- Phase 01 — Platform Core
- Phase 02 — App Shell Foundation
- AC-00 — forensic accounting behavioral baseline
- AC-01 — accounting domain architecture
- AC-02 — shared accounting contract/kernel foundations
- AC-03 — Currency/FX + Cost Center reference kernels
- AC-04 — Period Control + General Ledger
- AC-05 — Financial Controls & Reconciliation
- AC-06 — Billing, AR/AP, adjustments, advances, tax snapshots
- AC-07 — Treasury & Settlement
- AC-08 — Party Accounting + Expense/Commission/Recognition
- AC-09 — Assets & Financing
- AC-10 — Procurement Finance
- AC-11 — Tourism Contract Inventory
- AC-12 — Tourism/Hajj/Umrah Financial Orchestration
- AC-13 — Reporting and cross-module financial integration acceptance
- AC-14 — migration/cutover/equivalence after separate approval

Do not infer a later phase merely from old chat wording. Always use `docs/accounting/ACCOUNTING-BUILD-SEQUENCE.md` as the canonical sequence.

## 8. Current handoff point at creation of this file

At the time this file was created:
- AC-11 is CLOSED / APPROVED / MERGED.
- AC-11 final merge to main: PR #35.
- Main merge SHA: `6fd8d019568f3c1927b64f7dffc4c30b301a74e9`.
- Next phase: **AC-12 — Tourism / Hajj / Umrah Financial Orchestration**.
- AC-12 canonical rules: BR-043–BR-051, BR-053, BR-054, BR-066, BR-068.
- AC-12 canonical golden scenarios: GS-023–GS-028.
- AC-12 integration acceptance also consumes prior-owner rules listed in the build sequence; it must not reimplement their ownership.

For the current truth, always read `PROJECT_STATE.md` after this section.

## 9. How to recover if PROJECT_STATE.md is stale

Before asking the owner to remember details:
1. Inspect current `main` HEAD.
2. Inspect recently merged PRs into `main`.
3. Inspect open phase PRs and their base/head branches.
4. Compare current phase branch with `main`.
5. Read the current build-sequence and coverage matrix.
6. Inspect the latest CI workflow and exact failed/passed steps.
7. Update `PROJECT_STATE.md` before continuing.

Never reconstruct state from commit titles alone.

## 10. Decision policy

Use:
- **PASS** — scope implemented correctly, required evidence exists, gates pass.
- **FIX REQUIRED** — specific proven blocker exists; issue one targeted correction prompt.
- **BLOCKED** — missing prerequisite, inaccessible source, unresolvable dependency, or environment prevents valid completion.

Do not call a phase incomplete merely because an optional improvement exists.

Do not call a phase complete from README claims, agent summaries, or green CI alone.

## 11. Future-manager rule

A replacement manager is not required to imitate the wording of a previous chat. It is required to preserve:
- architecture;
- accepted ownership;
- phase order;
- business-rule/scenario ownership;
- current GitHub state;
- the owner's no-patching/no-restart preference;
- evidence-based review;
- clean targeted implementation.

This repository, not one conversation, is the continuity mechanism.
