# AI CHANGE PROTOCOL — MANDATORY FOR EVERY FUTURE MODIFICATION

This is the permanent change discipline for **Elhafez Business Accounting**.

It applies to ChatGPT Codex, Qwen Code, Claude, Antigravity, IDE agents, human developers, and any future coding tool.

The goal is simple:

> A requested change must look as if it was designed cleanly into the system from the beginning.  
> No patch-on-patch implementation. No unrelated breakage. No architecture erosion.

## 1. Mandatory preflight

Before changing any code, read:
- `AGENTS.md`
- `PROJECT_MANAGER_HANDOFF.md`
- `PROJECT_STATE.md`
- `docs/ARCHITECTURE.md`
- `docs/MODULE-STANDARD.md`
- `docs/TESTING-STANDARD.md`

For accounting/financial changes also read:
- `docs/accounting/ACCOUNTING-ARCHITECTURE.md`
- `docs/accounting/ACCOUNTING-DATA-OWNERSHIP.md`
- `docs/accounting/ACCOUNTING-DEPENDENCY-GRAPH.md`
- `docs/accounting/ACCOUNTING-CONTRACTS-CATALOG.md`
- `docs/accounting/ACCOUNTING-AC00-COVERAGE-MATRIX.md`

Then inspect the actual owning module and its tests before editing.

### Machine-enforced preflight

Every pull request must add exactly one `.changes/<change-id>.json` manifest. It declares:
- the requested change summary;
- the allowed owning modules;
- the non-module paths that may change;
- any protected global paths that genuinely must change and why;
- whether a breaking public API removal is explicitly authorized.

CI compares that declaration with the real Git diff. Undeclared blast radius fails the PR.

## 2. Define the change boundary first

Write down internally before editing:
- requested behavior;
- owning module;
- current public contract/API involved;
- data/schema impact;
- UI surface impact;
- tests that prove the change;
- files/modules that are explicitly out of scope.

If ownership is unclear, stop and determine ownership. Do not spread a small feature across unrelated modules.

## 3. Targeted-change rule

Change only what is required to implement the requested behavior correctly.

A local customer-field change must not casually modify:
- sidebar/navigation;
- authentication;
- accounting core;
- shared design tokens;
- unrelated forms;
- unrelated database tables;
- unrelated module contracts.

If a wider change is genuinely required, explain the dependency and keep it minimal.

## 4. Clean implementation rule — NO PATCHING

Forbidden patterns:
- adding a second workaround beside an existing broken path;
- duplicate fields/services with slightly different names;
- wrapper-after-wrapper to avoid fixing the real local design;
- global CSS overrides for one screen;
- global lint/TypeScript rule weakening;
- `any`/unsafe casts used to bypass a boundary;
- direct Prisma access to another module;
- hidden fallback behavior;
- silent catch-and-ignore;
- fake IDs/evidence;
- temporary code left as permanent architecture;
- editing old migrations to force a new state;
- copying another module's business logic instead of calling its public API.

Required behavior:
- modify the existing canonical path;
- remove obsolete local code made unnecessary by the change;
- keep one source of truth;
- preserve naming/style conventions;
- leave the area cleaner or equally clean, never more layered.

## 5. Module ownership

A module owns:
- its domain model;
- application use cases;
- repository ports/adapters;
- owned Prisma tables;
- migrations for its owned data;
- public API.

No module may:
- write another module's tables;
- import another module's `src/domain`, `src/application`, or `src/infrastructure`;
- call another module's private repository;
- infer another module's financial truth from copied data.

Use the provider package root/public application service.

## 6. Database/schema changes

When a requested change requires persistence:
- use an additive migration;
- never rewrite accepted historical migrations;
- preserve company/branch scope;
- preserve audit/history requirements;
- add appropriate uniqueness/indexes/constraints;
- use explicit field mapping;
- do not spread entire command objects into Prisma writes;
- do not delete economic history to make a workflow easy.

If a field is merely optional UI information, do not invent accounting consequences for it.

## 7. Financial safety

For financial/economic behavior:
- use exact decimal arithmetic;
- keep posted/economic history immutable;
- correction is by amendment/reversal/adjustment as owned by the domain;
- use durable idempotency for retryable state changes;
- make race-sensitive capacity/money operations concurrency-safe;
- enforce company/branch isolation server-side;
- never trust the UI as the security boundary;
- never fabricate GL, invoice, payment, procurement, or evidence references.

## 8. UI safety

UI changes must be local by default.

Do not alter:
- app shell;
- sidebar;
- global typography;
- global spacing;
- responsive breakpoints;
- design tokens

for a local field/control unless the request explicitly requires a global design-system change.

Use existing shared UI components and patterns.

Preserve:
- RTL;
- Arabic/English readiness;
- responsiveness;
- keyboard/accessibility behavior;
- existing form validation patterns.

## 9. Example — “Add WhatsApp number to Customer”

Correct approach:
1. Identify the Customer/Party owner.
2. Inspect the canonical customer entity/DTO/form.
3. Decide whether WhatsApp number is:
   - the same as phone with a flag, or
   - a separate optional field,
   based on current domain conventions.
4. Add the field in the owning domain/public contract only if needed.
5. Add additive persistence migration if the value is stored.
6. Update the application service/repository mapping.
7. Update only the customer create/edit/view UI surfaces.
8. Add validation and tests.
9. Verify no unrelated sidebar/shell/accounting files changed.
10. Run quality gates.

Wrong approach:
- create a new “Customer WhatsApp” mini-module;
- put the field in shared core;
- modify the sidebar to make the form work;
- add a second customer save path;
- use a global CSS override;
- write a one-off SQL call from UI/API;
- weaken validation to get the change through.

## 10. Refactoring inside a requested change

A small local refactor is allowed when necessary to make the requested change clean.

It must:
- stay inside the affected ownership boundary;
- preserve public behavior except for the requested change;
- remove duplication rather than introduce abstraction for its own sake;
- have tests.

A broad architectural refactor requires explicit owner approval.

## 11. Tests are part of the change

A change is incomplete without tests proving:
- the new behavior;
- important unchanged behavior near it;
- company/branch isolation when relevant;
- idempotency/concurrency when relevant;
- no regression to public contracts.

Do not replace behavioral tests with source-code regex checks.

## 12. Machine-enforced anti-patching guards

The repository enforces these rules in CI:
- change scope / blast-radius allowlist;
- protected global paths;
- generated-artifact rejection;
- accepted migration immutability;
- backward-compatible module public API by default;
- unique table ownership;
- module dependency DAG / cycle rejection;
- domain-layer framework/ORM isolation;
- direct Prisma access cannot cross module ownership;
- route IDs and paths are unique;
- global shell structure has regression tests.

These checks are not a substitute for review; they are a hard floor that coding tools cannot bypass by merely claiming compliance.

## 13. Required gates

Before declaring completion:
- `pnpm install --frozen-lockfile`
- `pnpm change-safety:check`
- `pnpm prisma:generate` when Prisma is touched or generated client is required
- focused module typecheck/tests
- `pnpm typecheck`
- `pnpm lint`
- `pnpm architecture:check`
- `pnpm test`
- `pnpm verify` when defined/appropriate
- `git diff --check`

If a gate cannot run, state `NOT RUN` and why. Never claim PASS without execution/evidence.

## 14. Final diff review

Before publishing:
- inspect `git status`;
- inspect `git diff --stat`;
- inspect changed filenames.

Remove:
- `*.tsbuildinfo`;
- build/dist output;
- coverage;
- temporary files;
- generated caches;
- secrets;
- accidental `.env`;
- unrelated formatting churn;
- unrelated lockfile changes;
- broad config rewrites not required by the task.

## 15. Completion report

Every coding agent must report:
- exact requested behavior implemented;
- branch/commit;
- files changed;
- schema/migration change;
- public API change;
- tests added/updated;
- exact quality gates and results;
- any unresolved blocker;
- confirmation that unrelated modules were not changed except where explicitly justified.

## 16. Stop conditions

Stop and report `BLOCKED` instead of improvising when:
- the required owner/public API does not exist and adding one would change architecture;
- the requested change conflicts with an accepted invariant;
- the baseline is missing required source;
- a migration/history decision is ambiguous and financially destructive;
- required credentials/data are unavailable;
- implementation would require bypassing module ownership.

Never “make it work” by breaking the architecture.

## 17. Principle of minimum blast radius

The safest successful change is the smallest clean change that:
- satisfies the requirement;
- follows existing structure;
- has explicit tests;
- preserves all unrelated behavior;
- leaves one canonical implementation path.

That is the default for every future modification.
