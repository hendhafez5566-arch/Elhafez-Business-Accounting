# ELHAFEZ COMPLETE LEGACY FORENSIC FEATURE INVENTORY
## Accelerated Video + Frozen Source + New-System Parity Report

**Mode:** REPORT ONLY — لا برمجة، لا Merge، لا Deploy  
**Legacy frozen reference:** `Elhafez-Tourism-Offline v32.5.66 @ e97fa6d9cb52acb22b676e1b975c1b2332bc9a13`  
**New baseline:** `Elhafez-Business-Accounting main@d633f1dcfd0c1fc5cbf61912a07445f5eeeb71ad`  
**Video evidence:** `accounting-system-compressed-full(1).mp4` — 12:10.6  
**Method:** scene-change extraction + frozen-source registry + current-route/module mapping.

---

# 1 — لماذا هذا التقرير أسرع من الفحص اليدوي؟

بدل مشاهدة الفيديو ثانية بثانية فقط، تم استخراج تغييرات المشاهد تلقائيًا وفهرستها، ثم تمت مطابقتها مع تعريفات الواجهة والنماذج في المصدر المجمد. بهذه الطريقة نقلل الوقت بدون الاعتماد على الذاكرة أو الاكتفاء بعناوين الأقسام.

---

# 2 — COVERAGE GATE

| Evidence source | Count | Coverage |
|---|---:|---|
| Legacy top-level navigation entries | 46 | 46/46 |
| Frozen core forms | 40 | 40/40 |
| Frozen core form fields | 322 | 322/322 |
| Full-video scene changes indexed | 149 | 149/149 |
| Frozen Hajj/Umrah raw UI occurrences in five core UI files | 699 | source-count verified |
| Major Hajj/Umrah controls/actions promoted into implementation registry | 86 | 86/86 |
| Print/document/report catalog items | 44 | 44/44 |

**Navigation Unclassified = 0**  
**Core form fields Unclassified = 0**  
**Video scene index Unclassified = 0**

Important: `PRESENT_CANDIDATE` means an equivalent label/surface exists and the executor must verify behavior/validation; it is not permission to skip verification.

---

# 3 — TOP-LEVEL LEGACY PARITY

Status totals: {'PARTIAL': 18, 'PARITY': 13, 'NEW_BETTER': 12, 'MISSING': 2, 'REBUILD_DIFFERENTLY': 1}

| Legacy | Status | New target | Decision |
|---|---|---|---|
| لوحة التحكم | NEW_BETTER | `/` | الرئيسية + الإدارة والتحكم |
| نظام الحج والعمرة | PARTIAL | `/hajj-umrah/program-workspace` | موزع بين برامج الحج والعمرة، مساحة عمل البرنامج، الجاهزية والتشغيل |
| التعاقدات والمخزون | PARITY | `/hajj-umrah/contracts-inventory` | التعاقدات والمخزون موجودة |
| إدارة الحج والعمرة | NEW_BETTER | `/hajj-umrah/readiness` | مركز الجاهزية والتشغيل + صفحات تشغيل مستقلة |
| العملاء المحتملون والمتابعة | PARITY | `/crm/leads + /crm/followups` | العملاء المحتملون والمتابعات منفصلان |
| العملاء | PARTIAL | `/crm/customers + /crm/customer-360` | العميل موجود لكن 360 أقل عمقًا من القديم |
| المندوبون | PARTIAL | `/crm/agents + /crm/agent-360` | الوكيل موجود لكن يحتاج عمقًا تشغيليًا وماليًا |
| عروض الأسعار | NEW_BETTER | `/crm/quotations` | Lifecycle والمراجعات والموافقات أقوى |
| الخدمات السياحية | PARTIAL | `/tourism/services` | الخدمات موجودة؛ بعض العلاقات ما زالت تقنية |
| الموردون | NEW_BETTER | `/procurement/suppliers` | إدارة وتقييم ومتابعة أوسع |
| أوامر الشراء | NEW_BETTER | `/procurement/purchase-orders + /procurement/sourcing` | أوامر الشراء والتوريد أقوى |
| الفواتير | PARTIAL | `/accounting` | موجودة داخل Workspace |
| سندات القبض | PARTIAL | `/accounting` | موجودة ضمن الخزينة/التسوية والوصول أقل مباشرة |
| سندات الصرف | PARTIAL | `/accounting` | موجودة ضمن الخزينة/التسوية والوصول أقل مباشرة |
| المصروفات | PARTIAL | `/accounting` | موجودة داخل المحاسبة |
| التسويات والإلغاءات | PARTIAL | `/accounting` | موجودة لكن بعض UX تقني |
| الاستحقاقات والإيراد المؤجل | PARTIAL | `/accounting` | موجودة لكن بعض التدفقات تقنية |
| الأصول الثابتة | PARTIAL | `/accounting` | موجودة داخل Workspace |
| القروض والمخصصات | PARTIAL | `/accounting` | موجودة داخل Workspace |
| الموازنات | PARTIAL | `/accounting` | موجودة داخل Workspace |
| الشيكات | PARTIAL | `/accounting` | منطق الشيكات موجود لكن واجهة كاملة تحتاج إغلاق |
| الخزن والبنوك | PARTIAL | `/accounting` | الخزن والبنوك موجودة؛ التحويل والجرد والمطابقة تحتاج UI مكتملة |
| القيود اليومية | PARITY | `/accounting` | القيود موجودة |
| دليل الحسابات | PARITY | `/accounting` | دليل الحسابات موجود |
| ميزان المراجعة | PARITY | `/management/reports + /accounting` | ميزان المراجعة والتقارير موجودان |
| مراكز التكلفة | PARITY | `/accounting` | مراكز التكلفة موجودة |
| العملات وأسعار الصرف | PARITY | `/accounting` | العملات وFX موجودة |
| الضرائب | PARITY | `/accounting + /management/reports` | الضرائب موجودة |
| الفترات المالية | PARITY | `/accounting` | الفترات والإقفال موجودان |
| مركز العمل اليومي | NEW_BETTER | `/management/exceptions` | مركز العمل والاستثناءات أقوى |
| لوحة الإدارة | NEW_BETTER | `/management/*` | لوحات الإدارة والتحكم أوسع |
| التقارير | NEW_BETTER | `/management/reports` | Reporting Center أوسع |
| الاعتمادات | NEW_BETTER | `/management/approvals` | مركز موافقات مستقل |
| الرقابة المالية | PARTIAL | `/accounting + /system-administration` | الرقابة موجودة وتحتاج direct UX مماثل |
| سجل النشاط | PARITY | `/system-administration` | Audit/activity موجود |
| جاهزية البيع والتشغيل | MISSING | `—` | لا يوجد route مخصص مكافئ في baseline |
| دليل البدء السريع | MISSING | `—` | لا يوجد route مخصص مكافئ في baseline |
| المستخدمون والصلاحيات | PARITY | `/system-administration` | المستخدمون والصلاحيات موجودة |
| الفروع | PARITY | `/system-administration` | الفروع والوصول موجودان |
| مركز المستندات | PARTIAL | `/system-administration` | Files موجودة لكن الربط داخل 360 وصفحات الأعمال أقل |
| الجلسات والأجهزة | PARITY | `/system-administration` | إدارة الجلسات موجودة |
| استيراد وتصدير | NEW_BETTER | `/system-administration` | استيراد/تصدير وإدارة Jobs |
| الدعم وحالة النظام | NEW_BETTER | `/system-administration` | Diagnostics/operations أقوى |
| الإعدادات | PARTIAL | `/system-administration + /settings/*` | هوية الشركة والطباعة تحتاج توحيدًا |
| النسخ الاحتياطي والاستعادة | NEW_BETTER | `Owner Control` | Backup/Restore/diagnostics أقوى ومركزي |
| الأرشفة الذكية | REBUILD_DIFFERENTLY | `/accounting` | يمثل كفترات مغلقة/قراءة فقط وليس أرشيف بيانات موازٍ |

---

# 4 — FROZEN CORE FORMS

The frozen source contains **40 forms and 322 fields**. Every field is listed in `LEGACY_CORE_FORM_FIELDS.csv`.

Mapping-gate totals:

- PRESENT_CANDIDATE: 39
- VERIFY_PARITY: 248
- MISSING_OR_NOT_EXPOSED: 35

## High-risk fields not clearly exposed in the new UI baseline

- **supplier → عملة التعامل** → owner `supplier-management`
- **supplier → IBAN** → owner `supplier-management`
- **agent → طريقة العمولة** → owner `agent-management`
- **agent → عملة العمولة** → owner `agent-management`
- **program → غرف ثلاثي** → owner `hajj-umrah-programs / tourism-programs`
- **program → غرف رباعي** → owner `hajj-umrah-programs / tourism-programs`
- **program → سعر رباعي للفرد** → owner `hajj-umrah-programs / tourism-programs`
- **program → سعر ثلاثي للفرد** → owner `hajj-umrah-programs / tourism-programs`
- **program → سعر ثنائي للفرد** → owner `hajj-umrah-programs / tourism-programs`
- **program → سعر فردي للفرد** → owner `hajj-umrah-programs / tourism-programs`
- **program → سعر طفل** → owner `hajj-umrah-programs / tourism-programs`
- **program → ليالي مكة** → owner `hajj-umrah-programs / tourism-programs`
- **program → ليالي المدينة** → owner `hajj-umrah-programs / tourism-programs`
- **program → رحلة الذهاب** → owner `hajj-umrah-programs / tourism-programs`
- **program → خط سير / برنامج الرحلة** → owner `hajj-umrah-programs / tourism-programs`
- **receipt → طريقة الدفع** → owner `treasury-settlement`
- **payment → طريقة الدفع** → owner `treasury-settlement`
- **expense → طريقة الدفع** → owner `expense-commission`
- **commissionRule → نطاق القاعدة** → owner `expense-commission`
- **commissionRule → طريقة العمولة** → owner `expense-commission`
- **commissionPay → طريقة الدفع** → owner `expense-commission`
- **treasury → الرصيد الافتتاحي** → owner `treasury-settlement`
- **treasury → IBAN** → owner `treasury-settlement`
- **treasury → حد تنبيه الرصيد** → owner `treasury-settlement`
- **cashCount → الرصيد الفعلي** → owner `treasury-settlement`
- **cashCount → معالجة فرق الجرد** → owner `treasury-settlement`
- **currency → الكسور العشرية** → owner `currency-fx`
- **costcenter → الموازنة التقديرية** → owner `cost-centers-budgeting`
- **user → أقصى خصم مسموح %** → owner `platform-core / auth`
- **revenueDeferral → أول تاريخ اعتراف** → owner `recognition-accrual`
- **revenueDeferral → عدد دفعات الاعتراف** → owner `recognition-accrual`
- **costDeferral → أول تاريخ تحميل للتكلفة** → owner `recognition-accrual`
- **costDeferral → عدد دفعات التحميل** → owner `recognition-accrual`
- **loan → عدد الأقساط الشهرية** → owner `assets-financing`
- **bankStatement → حركات الكشف** → owner `treasury-settlement`

These must not be blindly added just because the label is absent. The executor must first check whether the same business meaning exists under another field/read model. If absent, rebuild it in the canonical owner.

---

# 5 — HAJJ & UMRAH FORENSIC COVERAGE

The frozen source contains a dense operational UI beyond the top-level routes. Direct source counting over the five principal UI/form files produced:

- **333 `<label>` occurrences**
- **190 button occurrences**
- **49 heading occurrences**
- **127 option occurrences**
- **699 total raw UI-control occurrences**

The major business controls/actions have been promoted to `LEGACY_HAJJ_UMRAH_MAJOR_CONTROLS.csv`.

Mandatory parity subjects include:

- seasons and sale windows;
- hotel / flight / transport / visa / service contracts;
- contract amendments and cancellation;
- allocations and inventory release;
- program wizard with 6 stages;
- program/group metadata;
- temporary hold and deposit rules;
- room-type pricing;
- children/infant pricing;
- Makkah/Madinah stays and extra stays;
- flight blocks and schedules;
- transport and visa allocation;
- guided readiness;
- program cost/profit review;
- open for sale / close sale / operating / departed / returned / close / cancel;
- booking creation and continuation;
- traveler records/passports;
- room distribution;
- visa operation;
- ticket/flight operation;
- transport/manifest;
- trip tasks/incidents/service execution;
- supplier commitments/procurement;
- program summary print;
- visa list print;
- attachments/output center.

**Rule:** no raw JSON, comma-separated IDs, UUID copy/paste, or internal source IDs in employee-facing flows.

---

# 6 — CUSTOMER / AGENT / SUPPLIER 360

Legacy behavior is not just a master-data card. The reconstructed parity target must include:

- identity and contacts;
- status/suspend/reactivate/safe delete;
- commercial terms;
- assigned agent;
- WhatsApp;
- bookings/travelers;
- quotations;
- invoices;
- receipts/payments;
- purchase orders / supplier commitments where applicable;
- commissions;
- statements and balances;
- documents and attachments;
- latest activity/audit;
- print/share actions.

The new system already has 360 pages, but the executor must treat them as **PARTIAL until all legacy sections are reconciled item by item**.

---

# 7 — TREASURY / BANKS / CHEQUES

Legacy functional parity requires:

- cash/bank master;
- opening balance;
- custodian/bank/account/IBAN/branch;
- balance warning threshold;
- receipts;
- payments;
- transfers;
- cash count;
- cash-count variance treatment;
- cheques incoming/outgoing;
- cheque deposit/clear/bounce/void/redeposit;
- bank statement entry/import;
- bank reconciliation;
- treasury/bank movement report.

The new architecture should remain the owner. Missing UI must expose the existing domain through proper read/write APIs; never add a second treasury implementation.

---

# 8 — PRINTING / PDF / WHATSAPP / REPORTS

The frozen print engine proves a legacy document system with:

- company logo/name/phone/tax number/commercial register;
- accountant/reviewer/approval blocks;
- amount in words;
- editable print narrative without changing accounting source data;
- PDF generation;
- native share;
- WhatsApp PDF;
- deterministic file identity/name.

The exact catalog is in `LEGACY_PRINT_REPORT_CATALOG.csv`.

The new system's reporting center is stronger architecturally, but **exact template parity remains a separate gate**. A report is not counted as parity merely because similar data exists.

---

# 9 — VIDEO FORENSIC INDEX

The full legacy walkthrough was indexed into **149 scene changes**. See `LEGACY_VIDEO_SCENE_INDEX.csv`.

Observed operational spine in the recording:

1. login / dashboard / branch context;
2. settings/system shell;
3. CRM, customers, agents, quotations;
4. tourism services;
5. suppliers and purchase orders;
6. invoices, receipts, payments, expenses and commissions;
7. advanced accounting, treasury, accounts, taxes and periods;
8. reports/control/output/data exchange;
9. Hajj & Umrah dashboard, program, booking, readiness, contracts/inventory, group operation and outputs.

The video is used to prove actual visible/operated UX. Source is used to catch conditional features that the recording may not open.

---

# 10 — GLOBAL IMPLEMENTATION RULES

1. Legacy = functional/UX reference only.
2. New system = architecture/data-owner source of truth.
3. Do not copy legacy code or legacy DB design.
4. Do not create duplicate modules or duplicate sources of truth.
5. IDs remain internal.
6. User chooses customers/suppliers/agents/travelers/programs/contracts/resources by human-readable name/code.
7. No raw JSON in operational UI.
8. No `window.prompt`, `window.confirm`, `window.alert`.
9. Domain validation belongs in owner modules.
10. Use current shared UI primitives and RTL.
11. Keep new features that are better than legacy.
12. Retire a legacy behavior only with an explicit documented reason.

---

# 11 — REQUIRED ONE-PR EXECUTION PACKAGE

The implementation tool should consume these registries and produce:

- `LEGACY_PARITY_MATRIX.md`
- one row for every `LEG-*` item;
- status: `PARITY / PARTIAL / MISSING / NEW_BETTER / INTENTIONALLY_RETIRED`;
- source evidence;
- target owner;
- acceptance test;
- no unclassified row;
- one implementation branch;
- one PR;
- one full verification run after implementation.

Final gate:

```text
Legacy navigation unclassified = 0
Legacy core form fields unclassified = 0
Legacy report/catalog unclassified = 0
Legacy Hajj/Umrah promoted controls unclassified = 0
Raw employee-facing IDs = 0 unless explicitly business-relevant
Raw operational JSON inputs = 0
Browser prompt/confirm/alert = 0
Architecture-owner violations = 0
Skipped/weakened tests = 0
```

---

# 12 — IMPORTANT STATUS NOTE

A previous accidental implementation branch exists:

`chatgpt/full-legacy-feature-clean-rebuild`

**Do not merge it.**  
The implementation tool should start from the official current functional-closure branch baseline and use this report/registries as specification. The accidental branch may be inspected for ideas only after independent review.

---

# 13 — FINAL DECISION

This package is intentionally different from the earlier summary audit.

The earlier report answered: **"ما أهم الفجوات؟"**

This package answers: **"ما الذي كان موجودًا في القديم، وما الذي يجب ألا يُنسى عند إعادة البناء؟"**

The executable source of truth for the next tool is the registries in this directory, not a short prose summary.
