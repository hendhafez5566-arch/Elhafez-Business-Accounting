# Functional Closure — الحاجة اللي ناقصة

Authoritative implementation task for the final functional closure phase.

## Base and target
- Base Preview commit: `fb97758ce5c06e39a80e4c3f2fe57d3686ab44a7`
- Work branch: `functional-closure-missing-final`
- Final merge target after review: `preview/gemini-demo-login`
- Never merge or push this work to `main`.

## IMPORTANT — OFFLINE CODEX EXECUTION IS SUPPORTED

This task is intentionally self-contained for a Codex Cloud checkout that may have **no Git remote, no `gh` login, and no general internet access**.

Do **not** stop because `git remote -v` is empty, `gh auth status` fails, `git ls-remote` fails, or the legacy repository is not cloned under `/workspace`.

The authoritative frozen legacy evidence has already been audited outside this checkout and committed into this work branch under:

- `docs/tasks/legacy-forensic/ELHAFEZ_COMPLETE_LEGACY_FORENSIC_FEATURE_INVENTORY.md`
- `docs/tasks/legacy-forensic/MASTER_GAPS.csv`
- `docs/tasks/legacy-forensic/LEGACY_NAVIGATION_PARITY.csv`
- `docs/tasks/legacy-forensic/LEGACY_HAJJ_UMRAH_MAJOR_CONTROLS.csv`
- `docs/tasks/legacy-forensic/LEGACY_PRINT_REPORT_CATALOG.csv`

The forensic inventory is based on frozen legacy reference:
`Elhafez-Tourism-Offline v32.5.66 @ e97fa6d9cb52acb22b676e1b975c1b2332bc9a13`

Its evidence coverage is:
- legacy top-level navigation: 46/46;
- frozen core forms: 40/40;
- frozen core form fields: 322/322 (the aggregate report identifies the high-risk missing/not-exposed set; do not invent fields beyond evidence);
- video scene changes: 149/149;
- promoted Hajj/Umrah controls/actions: 86/86;
- print/document/report catalog: 44/44.

Therefore **live access to the OLD repository is NOT a prerequisite for this Codex execution**. Use the committed forensic evidence as the legacy functional specification and audit it against the current NEW repository checkout.

If GitHub Issue access is unavailable inside Codex, this file is authoritative and replaces the need to fetch Issue #129.

If shell Git push / PR creation is unavailable because the checkout has no remote, this is **not an implementation blocker**. Complete the code, tests, manifests, documentation and local commits first. Then use the Codex platform's Publish/Create PR action if available. If platform publishing is unavailable, report the final local commit SHA and leave the working tree clean; the reviewer will transfer the completed commit/diff to GitHub. Do not stop early for this reason.

## Architecture rule
OLD SYSTEM evidence is a functional/UI/UX reference only.
NEW SYSTEM `hendhafez5566-arch/Elhafez-Business-Accounting` is the architectural source of truth.

Never copy/paste legacy implementation. Never introduce duplicate APIs, services, tables, models, workflow owners, accounting owners, or parallel screens. If capability already exists in the new system, extend the canonical implementation. If old behavior is obsolete, unsafe, duplicated or conflicts with new architecture, document why it is intentionally not reproduced.

Read `AGENTS.md` and every governance/architecture/testing document it requires before editing.

## Required closure scope

### A. Legacy parity closure from the committed forensic specification
Audit the CURRENT new-system checkout against every applicable item in the committed forensic evidence. Create `LEGACY_PARITY_MATRIX.md` and close every still-relevant functional gap.

The matrix must cover at minimum:
- every `LEG-NAV-*` item in `LEGACY_NAVIGATION_PARITY.csv`;
- every `LEG-HU-MAJOR-*` item in `LEGACY_HAJJ_UMRAH_MAJOR_CONTROLS.csv`;
- every `LEG-PRINT-*` item in `LEGACY_PRINT_REPORT_CATALOG.csv`;
- every master gap in `MASTER_GAPS.csv`;
- every high-risk `MISSING_OR_NOT_EXPOSED` core-form field explicitly listed in the aggregate forensic report.

For each item record one final status:
`PARITY / PARTIAL / MISSING / NEW_BETTER / INTENTIONALLY_RETIRED`, plus target owner, evidence, implementation decision and acceptance test.

Do not count mere navigation or a label as functional parity. Verify routes, dialogs, actions, reports, prints, lifecycle actions, permissions, status transitions, 360/detail surfaces and operational workflows in the CURRENT checkout.

Any `PARTIAL` or `MISSING` item that remains relevant must be implemented in this branch. Any intentionally retired behavior needs a concrete architecture/safety/duplication reason.

### B. Document Catalog / Print / PDF / reporting outputs
Use the exact 44-item catalog in `LEGACY_PRINT_REPORT_CATALOG.csv`. Implement every still-relevant output supported by real canonical data.

Rules:
- reuse existing document/reporting infrastructure and canonical owner APIs;
- do not create a rendering engine per module;
- Arabic/RTL print-safe layouts;
- real tenant/company/branch permissions and data scope;
- no mock or invented business data;
- tests for output families and authorization;
- preserve legacy capabilities where applicable: company identity, approval/signature blocks, amount-in-words, PDF generation, deterministic file identity/name, share/WhatsApp integration where the platform safely supports it;
- if an entry is intentionally not an output, document the reason.

### C. Banking / Treasury branch provenance
Close known branch-scoping risks affecting bank statement lines, reconciliation candidates, treasury transfers and cash-count flows.

Requirements:
- durable branch provenance wherever required;
- safe schema migration/backfill plan if schema changes are necessary;
- a branch-scoped operator must never see or reconcile another branch's candidates;
- accounting source-of-truth and posting ownership stay canonical;
- close functional parity for opening balance, custodian/bank/account/IBAN/branch, warning threshold, receipts, payments, transfers, cash count, variance handling, incoming/outgoing cheque lifecycle, bank statement entry/import, reconciliation and treasury/bank movement reporting where not already complete;
- authorization, migration and reconciliation tests.

### D. Umrah Barcode real functionality
Replace the current functional placeholder through the existing canonical Hajj/Umrah route/page.

Requirements:
- identify canonical business owner and entity lifecycle from the CURRENT architecture;
- implement real persistence/API only where required by the domain;
- generate/assign/read/lookup/status lifecycle based on actual business need and existing Hajj/Umrah ownership;
- tenant/company/branch scoping, permissions and audit trail;
- no fake success state or mock truth;
- no duplicate/alternate Barcode page.

If the frozen forensic evidence does not establish a specific barcode data format or external-provider protocol, do **not invent an external standard**. Implement only the internal canonical lifecycle that can be justified by current domain entities, and clearly document any provider-specific integration as an external dependency rather than fabricating it.

### E. End-to-end workflow closure
Implement and/or test connected business flows, not isolated screens. At minimum cover:
1. CRM customer -> quotation -> approval/conversion -> resulting financial/business state.
2. Procurement supplier -> sourcing/PO or direct purchase -> payable/accounting result.
3. Tourism/Hajj-Umrah program/booking/service -> operational fulfillment/voucher -> billing/accounting result.
4. Treasury/banking -> settlement/reconciliation.
5. Real document/report output generated from canonical transaction owner.

Where an expected connection is missing, implement it through the existing owner boundary rather than creating a parallel integration.

### F. Legacy data migration & reconciliation rehearsal
Provide a repeatable non-production rehearsal path for importing/migrating legacy data and validating the result.

Must include:
- safe non-production defaults;
- idempotent/retry-safe behavior where practical;
- record-count reconciliation;
- key financial totals/balance reconciliation;
- ownership/scope validation;
- unresolved-exception report;
- retry/rollback documentation.

Do not modify production data. Do not invent a production export if no real legacy data file is present; build the rehearsal framework, fixtures/contracts and reconciliation gates against supported import shapes and clearly identify real-data execution as an operational step.

### G. Backup / Restore verification
Add a safe runbook/scripts/tests for backup and restore verification of the application data layer.

Rules:
- no destructive production execution;
- non-production/safe target by default;
- post-restore integrity, migration and smoke verification;
- clear recovery procedure;
- reuse Owner Control / existing backup ownership instead of creating a second backup system.

### H. Production readiness gates
Complete code-side release readiness artifacts without deploying production:
- environment/config inventory;
- startup/health/readiness validation;
- migration gate;
- backup gate;
- data reconciliation gate;
- smoke/UAT checklist;
- release and rollback checklist;
- ensure no preview-only insecure login behavior can accidentally become a production rule.

## Global parity gates
Before completion, the current codebase must be checked for and close relevant occurrences of:
- raw employee-facing internal IDs / UUID copy-paste where a business picker is required;
- raw operational JSON inputs;
- `window.prompt`, `window.confirm`, `window.alert` in operational business flows;
- missing attachments/activity inside relevant 360 surfaces;
- company legal/print identity gaps;
- missing Market Readiness / Quick Guide behavior (prefer read-only composition/onboarding over duplicate sources of truth).

Keep new-system capabilities that are better than legacy; parity is a floor, not a rollback.

## Governance and change manifests
Follow repository governance exactly. Prefer one valid change manifest if allowed. If the repository protocol requires multiple manifests because the work legitimately spans incompatible protected ownership scopes, use the minimum valid number; do not weaken the protocol or tests.

The legacy-forensic task documents already present on the branch are specification inputs, not implementation evidence. Do not edit them merely to make tests pass.

## Required validation
Run/fix until every locally available required check is green:
- change-safety
- engineering-integrity
- Prisma generate and migration validation where relevant
- full typecheck
- lint
- architecture check
- full test suite
- all new authorization, functional, document-output, migration/reconciliation and E2E tests

Do not bypass, delete or weaken failing tests.

## Completion report
Before declaring done, report explicitly:
- complete parity matrix for the committed forensic registries;
- each gap implemented;
- each gap intentionally excluded and why;
- every schema/migration change;
- every API/route/action added or extended;
- document catalog coverage and remaining intentionally non-output entries;
- Barcode lifecycle implemented and any genuine external dependency;
- E2E workflows covered;
- migration/reconciliation artifacts;
- backup/restore artifacts;
- production-readiness gates;
- all commands/tests and results;
- any remaining blocker.

If anything remains functionally incomplete, do not claim the system is finished.

## End-of-task publishing behavior
Complete implementation even if no Git remote exists in the shell.

When implementation is complete:
1. commit all work locally on `functional-closure-missing-final`;
2. keep the working tree clean;
3. use the Codex platform Publish/Create PR capability if available, targeting `preview/gemini-demo-login`;
4. never target `main`;
5. if platform publishing is unavailable, report the final local commit SHA and changed-file list/diff status; the reviewer will publish it externally.
