# PHASE 03 — ACCOUNTING LEGACY PRESENTATION BLUEPRINT

Status: SOURCE-DERIVED EXECUTION BLUEPRINT

This document is derived from the uploaded legacy source package `Elhafez-Tourism-Offline-main.zip` and the existing Phase 3 scope/visual notes. It describes the visible Accounting & Finance presentation that must be reimplemented on the target architecture.

Do not copy legacy DB access, event handlers or accounting logic. Recreate only the visible experience and bind it to canonical target owners/APIs.

## Legacy source map

Primary presentation sources:

- `src/ui/clean-pages.ts`
  - `invoices()`
  - `receipts()` / `payments()` via `vouchers(type)`
  - `expenses()`
  - `treasury()`
- `src/ui/pages.ts`
  - `cheques()`
  - `journal()`
  - `accounts()`
  - `trial()`
  - `costcenters()`
  - `currencies()`
  - `taxes()`
  - `periods()`
- `src/accounting/advanced-pages.ts`
  - `settlements()`
  - `accruals()`
  - `assets()`
  - `loans()`
  - `budgets()`
- `src/ui/forms-definitions.ts`
  - accounting form definitions and field ordering

Legacy behavior dependencies such as `DB`, `Accounting`, `AdvancedAccounting`, `Invoices`, `Auth` and direct action handlers are reference-only and MUST NOT be copied into the target UI.

---

## `/accounting/invoices` — الفواتير

Legacy source: `src/ui/clean-pages.ts -> invoices()`.

Required visible organization:

- Header: `الفواتير`
- Two primary tabs/buttons:
  - `المبيعات`
  - `المشتريات`
- Primary create action changes with active tab:
  - `+ فاتورة مبيعات`
  - `+ فاتورة مورد`
- KPI/filter strip:
  - all invoices
  - open remaining amount
  - overdue
  - paid
- Searchable/sortable table columns:
  - الفاتورة
  - الطرف
  - الإجمالي
  - المتبقي
  - الاستحقاق
  - الحالة
  - إجراء
- Row actions by status/permission:
  - ترحيل draft invoice
  - تحصيل customer invoice
  - سداد supplier invoice
  - طباعة
  - تعديل draft
  - إشعار دائن/مدين
  - إلغاء/void
- Do not show every invoice detail in the list; details are opened when needed.

Target implementation must preserve real Billing/Subledger ownership and target approval/state rules.

---

## `/accounting/receipts` — سندات القبض

Legacy source: `src/ui/clean-pages.ts -> receipts() -> vouchers('receipt')`.

Required visible organization:

- Header: `سندات القبض`
- Primary action: `+ سند قبض`
- KPI/filter strip:
  - كل المقبوضات
  - سارية
  - مخصصة
  - معكوسة
- Table columns:
  - السند
  - من
  - المبلغ
  - الطريقة
  - الحالة
  - إجراء
- Row actions:
  - طباعة
  - عكس/void when allowed
- Search includes number, party, date, reference and note/description.
- The visible workflow must distinguish allocated receipts from advances/unallocated receipts without exposing target module internals.

Bind to canonical Treasury/Settlement and billing allocation contracts. Do not reuse the generic Treasury page as the visible receipts screen.

---

## `/accounting/payments` — سندات الصرف

Legacy source: `src/ui/clean-pages.ts -> payments() -> vouchers('payment')`.

Required visible organization mirrors receipts but with payment semantics:

- Header: `سندات الصرف`
- Primary action: `+ سند صرف`
- KPI/filter strip:
  - كل المدفوعات
  - سارية
  - مخصصة
  - معكوسة
- Table columns:
  - السند
  - إلى
  - المبلغ
  - الطريقة
  - الحالة
  - إجراء
- Row actions:
  - طباعة
  - عكس/void
- Must support supplier/agent/other canonical target party references as supported by target contracts.

Do not render the generic Treasury composition as the route body.

---

## `/accounting/expenses` — المصروفات

Legacy source: `src/ui/clean-pages.ts -> expenses()`.

Required visible organization:

- Header: `المصروفات`
- Tools:
  - `إدارة التصنيفات`
  - `+ مصروف`
- KPI/filter strip:
  - كل المصروفات
  - مسودات
  - مرحلة
  - مقدمة
- Table columns:
  - المصروف
  - التصنيف
  - المبلغ
  - المعالجة
  - الحالة
  - إجراء
- Row actions by state:
  - ترحيل draft
  - طباعة
  - تعديل draft
  - حذف draft
  - عكس posted
- Prepaid/accrual detail should be opened from the record rather than mixing all schedules into the primary list.

Bind to canonical Expense/Commission Recognition and related target owners.

---

## `/accounting/settlements` — التسويات والإلغاءات

Legacy source: `src/accounting/advanced-pages.ts -> settlements()`.

Required visible organization:

Header/actions:

- `التسويات والإلغاءات`
- `تكوين مخصص ديون`
- `شطب من المخصص`
- `شطب مباشر`
- `رسوم إلغاء عميل`
- `+ تسوية إلغاء مورد`

Two visible sections:

### تسويات الموردين
Columns:
- الرقم
- التاريخ
- النوع
- المورد
- البرنامج
- القيمة
- الحساب
- الحالة
- إجراء

### تسويات العملاء
Columns:
- الرقم
- التاريخ
- النوع
- العميل
- البرنامج
- القيمة
- الحساب
- الحالة
- إجراء

Posted settlements may expose reversal when the target canonical contract allows it.

Legacy settlement/accounting calculations are not to be copied. Use canonical target accounting owners only.

---

## `/accounting/accruals` — الاستحقاقات والإيراد المؤجل

Legacy source: `src/accounting/advanced-pages.ts -> accruals()`.

Header/actions:

- `الاستحقاقات والإيراد المؤجل`
- `استحقاق رواتب`
- `إيراد مستحق`
- `تأجيل تكلفة مورد`
- `+ تأجيل إيراد فاتورة`

Visible sections:

1. `الإيرادات المؤجلة`
   - الرقم
   - الفاتورة
   - العميل
   - الإجمالي
   - المعترف
   - دفعات متبقية
   - الحالة
   - إجراء/الجدول

2. `تكاليف الموردين المؤجلة`
   - الرقم
   - الفاتورة
   - المورد
   - الإجمالي
   - المحمّل
   - دفعات متبقية
   - الحالة
   - إجراء/الجدول

3. `الإيرادات المستحقة`
   - الرقم
   - التاريخ
   - العميل
   - القيمة
   - حساب الإيراد
   - الحالة
   - إجراء

4. `مسيرات الرواتب`
   - الرقم
   - الفترة
   - الإجمالي
   - الاستقطاعات
   - الصافي
   - الحالة
   - إجراء

Use canonical recognition/accrual/asset-payroll contracts available in target. Unsupported legacy operations must be reported rather than simulated.

---

## `/accounting/cheques` — الشيكات

Legacy source: `src/ui/pages.ts -> cheques()`.

Required visible organization:

- Header: `الشيكات`
- KPI/filter strip:
  - كل الشيكات
  - واردة
  - صادرة
  - قيد التحصيل / الصرف
  - تمت
  - مرتدة
- Table columns:
  - رقم الشيك
  - الاتجاه
  - البنك
  - الاستحقاق
  - القيمة
  - الحالة
  - حساب البنك
  - إجراءات
- State actions include, when canonical target contracts allow:
  - إيداع بالبنك
  - تحصيل/صرف
  - ارتداد

The route must visibly present cheque lifecycle, not a generic treasury section.

---

## `/accounting/treasury` — الخزينة والبنوك

Legacy source: `src/ui/clean-pages.ts -> treasury()`.

This is a three-tab workspace, and the tabs are part of the required legacy-visible information architecture:

1. `الحسابات`
2. `التحويلات`
3. `المطابقة البنكية`

### الحسابات
- balance cards for active treasuries/banks showing name, currency and balance
- action `+ خزنة / بنك`
- table columns:
  - الحساب
  - النوع
  - العملة
  - الرصيد
  - الحالة
  - إجراء
- actions:
  - كشف الحركة
  - تعديل
  - تشغيل/إيقاف

### التحويلات
- action `+ تحويل`
- table columns:
  - التحويل
  - من
  - المبلغ
  - إلى
  - المستلم
  - الحالة
  - إجراء
- actions:
  - طباعة
  - عكس when allowed

### المطابقة البنكية
- actions:
  - استيراد كشف
  - مطابقة
- table columns:
  - المطابقة
  - البنك
  - رصيد النظام
  - كشف البنك
  - الفرق
  - الحالة

Bind to target Treasury Settlement and related bank reconciliation contracts.

---

## `/accounting/currencies` — العملات وأسعار الصرف

Legacy source: `src/ui/pages.ts -> currencies()`.

Required visible organization:

Header/actions:
- `العملات وأسعار الصرف`
- `إعادة تقييم العملات`
- `+ عملة`

Main currency table columns:
- الكود
- العملة
- الرمز
- السعر الحالي
- المصدر
- عدد الأسعار
- الحالة
- إجراءات

Visible actions may include:
- تعديل / سعر
- تحديث مباشر
- تشغيل/إيقاف
- حذف where valid

Secondary section:
- `إعادات التقييم`
- columns:
  - الرقم
  - التاريخ
  - عدد المراكز
  - الحالة

Use canonical Currency/FX owner and never compute financial revaluation independently in React.

---

## `/accounting/taxes` — الضرائب

Legacy source: `src/ui/pages.ts -> taxes()`.

Required visible organization:

Header/actions:
- `الضرائب`
- `+ كود ضريبة`
- `تقرير الضرائب`

Table columns:
- الكود
- الاسم
- النسبة
- الاستخدام
- مدخلات
- مخرجات
- الحالة
- إجراءات

Actions:
- تعديل
- تشغيل/إيقاف
- حذف where target rules permit

Use canonical Tax owner and its accounting mappings.

---

## `/accounting/periods` — الفترات المالية

Legacy source: `src/ui/pages.ts -> periods()`.

Required visible organization contains two sections:

### السنوات المالية
Columns:
- السنة
- من
- إلى
- الحالة
- إجراء

Possible actions when canonical target rules allow:
- إقفال السنة
- إعادة فتح

### فترات السنة الحالية
Columns:
- الفترة
- من
- إلى
- الحالة
- إجراء

Possible actions:
- فحص الإقفال
- إغلاق
- إعادة فتح

Financial period state remains Accounting-owned. Administration/period-archiving must not become a second owner.

---

## `/accounting/journal` — القيود اليومية

Legacy source: `src/ui/pages.ts -> journal()`.

Required visible organization:

Header/action:
- `القيود اليومية`
- `+ قيد يدوي`

Filter strip:
- كل القيود المرحلة
- سارية
- معكوسة

Three sections:

### مسودات القيود اليدوية
Columns:
- الرقم
- التاريخ
- البيان
- الحالة
- إجراءات

Actions may include:
- تعديل
- ترحيل
- حذف
- عكس after posting when allowed

### القيود المرحلة
Columns:
- رقم القيد
- التاريخ
- البيان
- المرجع
- مدين
- دائن
- الحالة
- إجراءات

Action:
- عرض / طباعة

### القوالب المتكررة
Columns:
- القالب
- التكرار
- الموعد القادم
- الحالة
- إجراء

Actions may include:
- إنشاء مسودة الآن
- تشغيل/إيقاف
- حذف

Use canonical General Ledger APIs. Do not reproduce journal posting logic in UI.

---

## `/accounting/accounts` — دليل الحسابات

Legacy source: `src/ui/pages.ts -> accounts()`.

Required visible organization:

Header/actions:
- `دليل الحسابات`
- `رصيد افتتاحي`
- `+ حساب / مجموعة`

Hierarchical account table columns:
- الكود
- الحساب
- التصنيف
- الطبيعة
- مدين
- دائن
- الصافي
- الحالة
- إجراءات

Visual hierarchy must preserve parent/child indentation and group/posting distinction.

Actions:
- كشف
- تعديل
- تشغيل/إيقاف where allowed
- حذف non-system accounts when valid

Use canonical General Ledger ownership and target immutable-history rules.

---

## `/accounting/trial` — ميزان المراجعة

Legacy source: `src/ui/pages.ts -> trial()`.

Required visible organization:

Header/action:
- `ميزان المراجعة`
- `طباعة`

Balance-health banner:
- clearly show balanced vs needs-review state
- show difference amount

KPI cards:
- إجمالي المدين
- إجمالي الدائن
- الفرق
- حسابات الترحيل

Table columns:
- الكود
- الحساب
- إجمالي مدين
- إجمالي دائن
- رصيد مدين
- رصيد دائن

Values must come from canonical target financial reporting/general ledger APIs. Do not recompute accounting truth from unrelated client-side arrays if the target owner provides the report.

---

## `/accounting/costcenters` — مراكز التكلفة

Legacy source: `src/ui/pages.ts -> costcenters()`.

Required visible organization:

Header/action:
- `مراكز التكلفة`
- `+ مركز تكلفة`

Hierarchical table columns:
- الكود
- المركز
- الأب
- المسؤول
- الموازنة
- الإيراد
- التكلفة
- النتيجة
- الانحراف
- الحالة
- إجراءات

Actions:
- تعديل
- تشغيل/إيقاف
- حذف only when target rules allow

Use canonical Cost/Budget Accounting owner. Revenue/cost/result values must use supported target projections/reports rather than legacy calculations copied into React.

---

## `/accounting/assets` — الأصول الثابتة

Legacy source: `src/accounting/advanced-pages.ts -> assets()`.

Required visible organization:

Header/action:
- `الأصول الثابتة`
- `+ أصل ثابت`

Table columns:
- الرقم
- الأصل
- الاقتناء
- التكلفة
- مجمع الإهلاك
- صافي القيمة
- العمر
- الحالة
- إجراءات

Actions when target contract permits:
- إهلاك
- استبعاد

Use canonical Assets/Financing owner. Do not calculate or post depreciation in the page.

---

## `/accounting/loans` — القروض والتمويل

Legacy source: `src/accounting/advanced-pages.ts -> loans()`.

Header/actions:
- `القروض والمخصصات`
- `تكوين مخصص`
- `+ قرض / تمويل`

Two sections:

### القروض والتمويلات
Columns:
- الرقم
- الممول
- الأصل
- الفائدة
- مسدد أصل
- القسط القادم
- الحالة
- إجراء

Action:
- سداد القسط when supported

### المخصصات
Columns:
- الرقم
- المخصص
- التاريخ
- المكوّن
- المستخدم
- المتبقي
- الحالة
- إجراء

Action:
- استخدام when supported

Use canonical Assets/Financing and accepted accounting owners.

---

## `/accounting/budgets` — الموازنات التقديرية

Legacy source: `src/accounting/advanced-pages.ts -> budgets()`.

Required visible organization:

Header/action:
- `الموازنات التقديرية`
- `+ بند موازنة`

Table columns:
- السنة
- الحساب
- مركز التكلفة
- الموازنة
- الفعلي
- الانحراف

Use canonical Cost/Budget Accounting owner. Do not reproduce legacy actual/variance calculations in the page when target projections exist.

---

## `/accounting` — Accounting landing / visible organization

The primary Accounting organization must follow the legacy business-facing grouping and ordering, not the internal target module graph.

The user-facing navigation should make the following areas directly understandable without exposing implementation modules:

- الفواتير
- سندات القبض
- سندات الصرف
- المصروفات
- التسويات
- الاستحقاقات
- الشيكات
- الخزينة والبنوك
- العملات وأسعار الصرف
- الضرائب
- الفترات المالية
- القيود اليومية
- دليل الحسابات
- ميزان المراجعة
- مراكز التكلفة
- الأصول
- القروض والتمويل
- الموازنات

Target-only capabilities may stay available through secondary/advanced paths when useful, but they must not force the primary Accounting workspace back into the target module-oriented generic workspace.

---

# Form guidance from legacy source

The legacy `src/ui/forms-definitions.ts` is the field-order reference for visible forms. Important examples include:

- supplier/customer cancellation and write-off forms under Settlements
- revenue deferral, supplier-cost deferral, accrued revenue and payroll under Accruals
- fixed asset creation fields including asset/depreciation accounts, funding mode, supplier/treasury and cost center
- loan fields including lender, date, principal, annual rate, installments, first due date, currency and treasury
- provision creation
- opening balance fields including account, debit/credit side, amount, currency, party for control accounts and cost center
- budget fields including year, month, account, cost center and amount
- bank statement import for Treasury reconciliation
- invoice adjustment/credit-debit note flow

Do not blindly add a legacy field if the target contract cannot support it. Preserve the visible requirement where meaningful and classify the missing contract explicitly.

# Implementation rule for Accounting

Do NOT solve these routes by exporting `AccountingSectionContent` or another generic target workspace composition and wrapping it with different headings.

Route-owned presentation may share low-level components, data hooks and API clients, but each visibly distinct legacy route must own the composition necessary to reproduce its documented screen.

A completed Accounting transplant should make the user recognize the old business organization while all persistence, rules and financial truth remain in the new architecture.
