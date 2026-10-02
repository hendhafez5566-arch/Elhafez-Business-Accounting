# Phase 02 — Batch C Legacy UI Recovery

## Scope

This batch closes the legacy-visible Phase 2 surfaces for:

- Reports / Control
- Administration / Settings

The implementation uses `06_Reports_Control.txt`, `07_Admin_Settings.txt`, the legacy UI package, and the old-system visual reference as UI/UX/functional evidence only. Target architecture, APIs, state, permissions and business truth remain canonical.

## Reports / Control

Legacy-visible entry order is preserved:

1. `/workcenter` — مركز العمل اليومي → existing `ManagementWorkCenterPage`.
2. `/owner` — لوحة الإدارة → existing `ExecutiveDashboardPage`.
3. `/reports` — التقارير → legacy report catalog that opens the existing Reporting Center for target-backed report execution, saved reports, schedules, date ranges, print/PDF and CSV.
4. `/approvals` — الاعتمادات → existing `ApprovalCenterPage` and its canonical decision contracts.
5. `/audit` — الرقابة المالية → read-only projection over `ReportingCenterClient` / Financial Controls / Management Control data with source-owner drill-down.
6. `/activity` — سجل النشاط → read-only projection over System Administration audit data.

Internal `/management/*` routes remain routable for existing drill-down links but are excluded from navigation so they do not create duplicate sidebar owners.

Recovered donor work already present in the target and reused rather than copied:

- PR #100: Reporting Center hardening, scoped financial reports, customer/supplier statements, saved reports, scheduling, control history, report outputs.
- PR #91: canonical Approval Center and reporting integration.
- PR #130: canonical legacy financial document renderer/catalog. No browser-side financial renderer was added.

## Administration / Settings

Legacy-visible entry order is preserved:

1. `/market-readiness` — جاهزية البيع والتشغيل
2. `/backup-center` — النسخ الاحتياطي والاستعادة
3. `/period-archiving` — الأرشفة الذكية
4. `/quick-guide` — دليل البدء السريع
5. `/users` — المستخدمون والصلاحيات
6. `/branches` — الفروع
7. `/documents` — مركز المستندات
8. `/sessions` — الجلسات والأجهزة
9. `/dataexchange` — استيراد وتصدير
10. `/support` — الدعم وحالة النظام
11. `/settings` — الإعدادات

`SystemAdministrationPage` now accepts `initialArea` so the legacy routes for users, branches, files, sessions, imports and diagnostics enter the existing canonical owner directly. No second RBAC, session, file, data-exchange, branch, notification or settings service was added.

`/settings` reuses `CompanyProfilePanel` and links to the existing numbering, appearance, account, notification, approval, accounting and backup owners.

Recovered donor work already present in the target and reused rather than copied:

- PR #101: System Administration owner and target administration contracts.
- PR #103 / `feature/admin-settings-final-closure`: company profile, platform foundations, numbering and administration final-closure UX.

## BLOCKED-BY-BACKEND

Only target-contract gaps are blocked; no fake persistence or fake success was added:

1. Tenant-admin backup create / verify / restore / backup-list actions. Real backup operations exist behind Owner Control / sensitive-owner authorization and MFA, while `/api/system-administration` exposes diagnostics only. The tenant UI therefore shows continuity/diagnostic state without calling Owner-only operations.
2. Legacy document archive metadata such as record type/id, description, expiry, categories/groups and expiry workflow. The current System Administration file contract accepts file content/content type and supports list/download/retire, but does not expose the legacy archive metadata contract.
3. Legacy notification-threshold configuration (passport/invoice/program/treasury thresholds) is not represented by a documented target settings contract. The Notification Center remains the owner of delivered notifications.
4. Legacy print-policy fields beyond current UI preferences/report output contracts (paper A4/A5/orientation, amount-in-words/signature/footer policy) do not have a canonical tenant settings contract in the current web administration surface.
5. Legacy report definitions that have no matching target reporting contract are shown as catalog requirements but are not computed in React. Target-backed reports continue through Reporting Center; unsupported definitions remain blocked until server report contracts exist.

## Target-contract exceptions

- Per-user payment approval limit and max-discount fields are not copied into the user entity. Approval thresholds/discount approvals remain owned by canonical Approval policies; access/cost visibility remains Platform Core RBAC.
- Period archiving is administrative navigation/readiness only. Financial period state and close ownership remain Accounting.
- Internal `/management/*` and `/system-administration/*` routes remain technical canonical targets for drill-down and deep links but are hidden from duplicate navigation.

## Replace — Not Overlay

- No `/manage` mirrors.
- No V2 business pages.
- No localStorage/sessionStorage business persistence.
- No copied legacy backend.
- No duplicated report calculations, approval truth, RBAC, backup owner, numbering owner, notification owner or accounting owner.
- Legacy-visible routes have one active route registration each.
