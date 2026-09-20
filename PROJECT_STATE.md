# PROJECT STATE — UPDATE AFTER EVERY ACCEPTED PHASE MERGE

Last verified: 2026-09-20

## Repository

- Repository: `mhafez300300-byte/Elhafez-Business-Accounting`
- Source of Truth: GitHub
- Last accepted business implementation baseline SHA (AC-14 merge): `350ba7dfc5e9e46e355a805a2c3dada1420ca53b`
- Always verify the live `main` HEAD before execution; governance-only commits may follow the business baseline.
- Current closed accounting phase: **AC-14**
- Accounting next phase: **None. There is no approved AC-15.**
- Post-AC-14 Business Platform architecture: **OWNER APPROVED** and defined by `docs/BUSINESS-MODULE-ARCHITECTURE.md` + `docs/BUSINESS-MODULE-ROUTING.md` (governance PR #55).
- Next business implementation phase: **NOT STARTED**. It must be selected from the canonical PLANNED module map; do not invent ownership from menu labels.

## Closed / accepted foundation

| Phase | Status | Main integration evidence |
|---|---|---|
| Phase 00 — Architecture Foundation | CLOSED / MERGED | PR #1 |
| Phase 01 — Platform Core | CLOSED / MERGED | PR #2 |
| Phase 02 — App Shell Foundation | CLOSED / MERGED | PR #4 (latest accepted shell foundation merge) |
| AC-00 — Forensic Accounting Audit | APPROVED BEHAVIORAL BASELINE | Legacy evidence baseline used by AC-01 |
| AC-01 — Accounting Domain Architecture | CLOSED / MERGED | PR #5 |
| AC-02 — Contract Kernel | CLOSED / MERGED | PR #7 |
| AC-03 — Reference Kernels | CLOSED / MERGED | PR #11 |
| AC-04 — Period Control + General Ledger | CLOSED / MERGED | PR #14 |
| AC-05 — Financial Controls & Reconciliation | CLOSED / MERGED | PR #16 |
| AC-06 — Billing & Subledgers | CLOSED / MERGED | PR #19 |
| AC-07 — Treasury & Settlement | CLOSED / MERGED | PR #23 |
| AC-08 — Party Accounting + Expense/Commission/Recognition | CLOSED / MERGED | PR #26 |
| AC-09 — Assets & Financing | CLOSED / MERGED | PR #28 |
| AC-10 — Procurement Finance | CLOSED / MERGED | PR #31 |
| AC-11 — Tourism Contract Inventory | CLOSED / MERGED | PR #35 |
| AC-12 — Tourism/Hajj/Umrah Financial Orchestration | CLOSED / MERGED | PR #41 |
| AC-13 — Financial Reporting & Cross-Module Integration Acceptance | CLOSED / MERGED | PR #44 |
| AC-14 — Migration / Cutover / Equivalence | CLOSED / MERGED | PR #53 |

## AC-11 final accepted state

Final main integration:
- PR #35 — `AC-11: merge Tourism Contract Inventory into main`
- Merge SHA: `6fd8d019568f3c1927b64f7dffc4c30b301a74e9`
- Phase branch merge SHA before main: `8205d27f8d88707a0cb4561bfdf49bd3a6948f33`
- Final reviewed implementation head: `285b1ec62c2a54b2569caf453bad024af396d788`

Accepted AC-11 ownership:
- BR-052
- BR-056 through BR-065
- GS-032 through GS-039

Final hardening includes:
- durable Prisma persistence/migration;
- exact-decimal capacity quantities;
- serializable transaction/concurrency protection;
- durable idempotency;
- company-scoped Visa Batch duplicate protection;
- contract version traceability;
- date-level hotel inventory;
- shared flight-block consumption;
- interval-overlap transport capacity;
- cumulative visa quota and stop-sale;
- internal-first fulfillment before Procurement;
- BR-061 resumable Cost public-boundary effect;
- BR-060 active program coverage protection;
- BR-063 authoritative server-side economic-history release blockers;
- behavioral acceptance tests for GS-032..GS-039.

Final phase/main PR CI was green for install, Prisma generation, typecheck, lint, architecture check and tests.

## AC-12 final accepted state

Final main integration:
- PR #41 — `AC-12: merge tourism finance orchestration into main`
- Main merge SHA: `343489c21f229b5dbc36a1515f466d15d19b5597`
- Phase branch merge SHA before main: `0cb76718b8d194c7af0247348bacbf5886f436a3`
- Final reviewed implementation head: `310ee882a9ede2342332b7f08928b7ac7c982829`
- Final real-provider integration acceptance head: `cabded23af72520d332e54bcb881fa076db0e0ee`

Accepted AC-12 canonical rules:
- BR-043 through BR-051
- BR-053
- BR-054
- BR-066
- BR-068

Accepted AC-12 canonical golden scenarios:
- GS-023 through GS-028

Accepted prior-owner integration rules:
- BR-021
- BR-037
- BR-042
- BR-052
- BR-055
- BR-056 through BR-065
- BR-067
- BR-069 through BR-071

Final AC-12 hardening includes:
- durable booking financial identity and idempotent confirmation workflows;
- immutable per-booking FinancialSetup snapshots reserved before provider financial effects;
- due-date-aware Billing confirmation and setup-owned account references;
- durable booking deposits, settlement/reversal and retained financial history;
- controlled booking and aggregate program cancellation with resumable child workflows;
- Procurement-owner cancellation cleanup policy with retry-safe delegation;
- authoritative financial readiness derived from persisted booking/program state;
- persisted approval, allocation, commission and Procurement evidence;
- readiness coverage for unresolved BOOKING_CONFIRMATION, BOOKING_DEPOSIT, BOOKING_SETTLEMENT and BOOKING_CANCELLATION workflows;
- semantic Cost actualization with concurrency-safe idempotency;
- invoice-scoped Billing advance cancellation evidence;
- exact-decimal and company/branch isolation preservation;
- real ApplicationService integration acceptance across Billing, Treasury, ECR, Procurement, Financial Controls and Cost, plus the public Tourism Contract Inventory boundary;
- Tourism Finance Orchestration acceptance suite at 31/31 passing tests.

Final implementation, phase and main PR CI was green for install, Change Safety, Prisma generation, typecheck, lint, architecture check and tests.

## AC-13 final accepted state

Final main integration:
- PR #44 — `AC-13: merge Financial Reporting and integration acceptance into main`
- Main merge SHA: `00883570188764f9791bdc5ecf0de4f2ec510b7a`
- Phase branch merge SHA before main: `5bc237c9e2f8a7750a600013ce838f6cfc3a3275`
- Final reviewed implementation head: `2528c4673b40847ca49cc2fe1bfbaef7fea2fcf5`

Canonical new rules:
- none — AC-13 is integration/regression only.

Canonical new golden scenarios:
- none — existing scenarios remain owned by their original phases and are regression evidence only.

Accepted integration rules:
- BR-072 — server independently protects financial immutability;
- BR-073 — permanent financial collections cannot be directly deleted;
- BR-074 — branch access is enforced on changed financial records;
- BR-075 — audit auto-fix remains intentionally narrow.

Final AC-13 hardening includes:
- canonical `@elhafez/financial-reporting` module with zero business-module compile-time dependencies;
- Reporting-owned durable/rebuildable `fr_reporting_evidence` projection, never accounting source truth;
- production Prisma Reporting repository with duplicate-delivery convergence, conflict detection and deterministic rebuild;
- exact-decimal, currency-separated trial balance, ledger, statements, aging, treasury, supplier, tax and program accounting reporting;
- trusted composition-root projection adapter fed by authoritative owner public results;
- GL journal lines carry the opaque Cost Center identity required by the canonical program-accounting architecture;
- program revenue and program cost/profit derive from authoritative posted GL lines tagged with the owned Cost Center, not operational estimates or non-GL actualization evidence;
- real owner evidence acceptance across GL, Billing, Treasury, Cost/Cost Center identity and Tax;
- behavioral BR-072..BR-075 integration acceptance through real Controls/Treasury application boundaries;
- company and branch scope preservation;
- architecture checker retained at its pre-AC-13 safety baseline.

Final implementation and phase-to-main CI was green for install, Change Safety, Prisma generation, typecheck, lint, architecture check and full tests.

## AC-14 final accepted state

Final main integration:
- PR #53 — `AC-14: migration, cutover, and equivalence`
- Main merge SHA: `350ba7dfc5e9e46e355a805a2c3dada1420ca53b`
- Official phase branch cumulative integration PR: #52
- Phase branch merge SHA before main: `70dab26c4c251088b041c4890647b4e6d668a853`
- Final reviewed implementation head: `f6bb637db53c9e55648f1ab88f15325d1579ca6e`
- Accepted AC-14A migration-control baseline on the phase branch: `c95ec1a4b2dbd2884a38758d0c89667f05e2d5b2`

Canonical new rules:
- none — AC-14 is migration/cutover/equivalence and regression only.

Canonical new golden scenarios:
- none new;
- GS-001 through GS-040 remain owned by their original phases and were retained as executable regression/cutover evidence.

Final AC-14 hardening includes:
- durable Migration Control kernel with runs, source SHA-256, crosswalks, checkpoints, issues and equivalence evidence;
- frozen legacy source identity pinned to `mhafez300300-byte/Elhafez-Tourism-Offline@e97fa6d9cb52acb22b676e1b975c1b2332bc9a13` / `v32.5.66`;
- deterministic frozen-source registry using real exported legacy collection keys, with explicit sourceCollection versus targetKind/importKind separation;
- no-silent-omission coverage: known non-empty legacy collections must be processed or explicitly classified and blocking where unsupported/ambiguous;
- owner-scoped historical restore into canonical owner state, with `*_historical_imports` retained as provenance/audit rather than accounting truth;
- canonical historical GL restore preserving exact historical base values, native-currency/FX evidence and reversal lineage without reposting economics;
- Billing/Treasury settlement-role separation so cash movement and invoice allocation are not duplicated;
- explicit handling/classification of advanced accounting and real Umrah/Hajj legacy collections, including operational-only state that must not be replayed as accounting effects;
- resumable role-level idempotency keyed by run + source collection + source id + owner + target kind, with processed counts reconciled from durable crosswalk truth;
- source-derived expected equivalence versus canonical owner actual state, with mismatches blocking readiness;
- Financial Reporting rebuilt from durable canonical owner evidence and never from imported legacy reporting rows or process-local state;
- cutover readiness requiring completed required stages, zero blocking issues, matching equivalence, reporting rebuild and GS-001..GS-040 evidence;
- company/branch isolation, exact-decimal behavior, module ownership and compile-time DAG preserved.

Final cumulative PR #52 and final main-targeting PR #53 both passed CI for frozen install, Change Safety, Prisma generation, typecheck, lint, architecture check and full tests.

## Post-AC-14 Business Platform architecture

Owner decision:
- continue the repository as the broader **ELHAFEZ Business Platform** while preserving the closed Accounting & Finance subsystem;
- organize the product into large user-facing suites, each composed of independently owned modules;
- allow shared modules to appear in multiple suites without duplicating code/data ownership;
- make canonical module routing mandatory for every coding tool before edits.

Canonical files:
- `docs/BUSINESS-MODULE-ARCHITECTURE.md`
- `docs/BUSINESS-MODULE-ROUTING.md`

Canonical top-level suites:
1. Hajj & Umrah
2. Tourism & Services
3. CRM & Sales
4. Suppliers & Procurement
5. Accounting & Finance — CLOSED / ACCEPTED
6. Management & Control
7. System Administration

Important accepted routing:
- `tourism-contract-inventory` remains the shared owner for contracts/allotment/capacity/inventory;
- existing Accounting modules remain sole owners of financial truth;
- `platform-core` remains owner of its accepted platform capabilities;
- future operational modules are created only from the canonical PLANNED owner map.

Governance record: PR #55.

## Post-AC-14 state

The approved accounting build sequence AC-00 through AC-14 is **CLOSED / ACCEPTED / MERGED**.

There is currently **no approved AC-15**.

Any future accounting work — including statutory e-invoicing, bank APIs/feeds, consolidation, HR/payroll calculation, or other new business scope — requires a separate owner-approved change/phase and must not be treated as unfinished AC-14 work.

## Update protocol

Whenever a future separately approved phase/change is closed, update this file with:
1. date;
2. accepted business implementation baseline SHA;
3. closed/current phase;
4. approved next phase, or explicitly state none;
5. final PR number;
6. phase merge SHA where applicable;
7. final reviewed implementation SHA;
8. concise accepted scope and blockers resolved.

Do not leave this file stale after a phase merge.
