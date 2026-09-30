# Functional Closure — الحاجة اللي ناقصة

Authoritative implementation task for the final functional closure phase.

## Base and target
- Base Preview commit: `fb97758ce5c06e39a80e4c3f2fe57d3686ab44a7`
- Work branch: `functional-closure-missing-final`
- Final merge target after review: `preview/gemini-demo-login`
- Never merge or push this work to `main`.

If GitHub Issue access is unavailable inside Codex, this file is authoritative and replaces the need to fetch Issue #129.

## Architecture rule
OLD SYSTEM `hendhafez5566-arch/Elhafez-Tourism-Offline` is a functional/UI/UX reference only.
NEW SYSTEM `hendhafez5566-arch/Elhafez-Business-Accounting` is the architectural source of truth.

Never copy/paste legacy implementation. Never introduce duplicate APIs, services, tables, models, workflow owners, accounting owners, or parallel screens. If capability already exists in the new system, extend the canonical implementation. If old behavior is obsolete, unsafe, duplicated or conflicts with new architecture, document why it is intentionally not reproduced.

Read `AGENTS.md` and every governance/architecture/testing document it requires before editing.

## Required closure scope

### A. Fresh legacy parity audit and closure
Compare OLD vs NEW end to end. Create an in-repo gap inventory and close every still-relevant functional gap. Include routes, dialogs, actions, reports, prints, lifecycle actions, permissions, status transitions, 360/detail screens and hidden operational workflows. Do not count mere navigation as functional parity.

### B. Document Catalog / Print / PDF / reporting outputs
The existing catalog includes entries that may only navigate rather than generate complete business outputs. Audit the full catalog (previous work identified 44 catalog entries) and implement every still-relevant output supported by real canonical data.

Rules:
- reuse existing document/reporting infrastructure and canonical owner APIs;
- do not create a rendering engine per module;
- Arabic/RTL print-safe layouts;
- real tenant/company/branch permissions and data scope;
- no mock or invented business data;
- tests for output families and authorization;
- if an entry is intentionally not an output, document the reason.

### C. Banking / Treasury branch provenance
Close known branch-scoping risks affecting bank statement lines, reconciliation candidates, treasury transfers and cash-count flows.

Requirements:
- durable branch provenance wherever required;
- safe schema migration/backfill plan if schema changes are necessary;
- a branch-scoped operator must never see or reconcile another branch's candidates;
- accounting source-of-truth and posting ownership stay canonical;
- authorization, migration and reconciliation tests.

### D. Umrah Barcode real functionality
Replace the current functional placeholder through the existing canonical Hajj/Umrah route/page.

Requirements:
- identify canonical business owner and entity lifecycle;
- implement real persistence/API only where required by the domain;
- generate/assign/read/lookup/status lifecycle based on actual business need found in the old system and new architecture;
- tenant/company/branch scoping, permissions and audit trail;
- no fake success state or mock truth;
- no duplicate/alternate Barcode page.

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

Do not modify production data.

### G. Backup / Restore verification
Add a safe runbook/scripts/tests for backup and restore verification of the application data layer.

Rules:
- no destructive production execution;
- non-production/safe target by default;
- post-restore integrity, migration and smoke verification;
- clear recovery procedure.

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

## Governance and change manifests
Follow repository governance exactly. Prefer one valid change manifest if allowed. If the repository protocol requires multiple manifests because the work legitimately spans incompatible protected ownership scopes, use the minimum valid number; do not weaken the protocol or tests.

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
- complete old-vs-new gap inventory;
- each gap implemented;
- each gap intentionally excluded and why;
- every schema/migration change;
- every API/route/action added or extended;
- document catalog coverage and remaining intentionally non-output entries;
- Barcode lifecycle implemented;
- E2E workflows covered;
- migration/reconciliation artifacts;
- backup/restore artifacts;
- production-readiness gates;
- all commands/tests and results;
- any remaining blocker.

If anything remains functionally incomplete, do not claim the system is finished.

When implementation is complete, commit/push only to the work branch and open a PR against `preview/gemini-demo-login`. Do not merge it yourself; final review, GitHub CI, corrections and merge are handled separately.