import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountingOverview } from '../../accounting-client.js';
import type { AccountingPresentationProps } from './accounting-pages.js';
import type { SalesInvoiceDraft } from './accounting-sales-invoice-dialog.js';

Object.assign(globalThis, { React });
const { filterAndSortRows } = await import('./accounting-page-shared.js');
const { invoicesForTab } = await import('./accounting-invoices-page.js');
const { salesInvoiceCompatibilityIssue } = await import('./accounting-sales-invoice-dialog.js');
const { treasuryTabLabel } = await import('./accounting-treasury-page.js');
const {
  AccountingLandingPage,
  AccountsPage,
  AccrualsPage,
  AssetsPage,
  BudgetsPage,
  ChequesPage,
  CostCentersPage,
  CurrenciesPage,
  ExpensesPage,
  InvoicesPage,
  JournalPage,
  LoansPage,
  PaymentsPage,
  PeriodsPage,
  ReceiptsPage,
  SettlementsPage,
  TaxesPage,
  TreasuryPage,
  TrialPage,
} = await import('./accounting-pages.js');

const data: AccountingOverview = {
  fiscalYears: [],
  periods: [],
  accounts: [
    { id: 'cash', code: '1100', name: 'النقدية', classification: 'ASSET', active: true, postable: true },
    { id: 'ar', code: '1200', name: 'العملاء', classification: 'ASSET', active: true, postable: true, controlType: 'CUSTOMER' },
    { id: 'revenue', code: '4100', name: 'إيرادات برامج العمرة', classification: 'REVENUE', active: true, postable: true },
  ],
  journals: [],
  invoices: [
    { id: 'i', type: 'CUSTOMER', status: 'POSTED', partyId: 'عميل-1', number: 'INV-1', postingDate: '2026-10-01', currency: 'EGP', baseTotal: '100.00', outstanding: '25.00', controlAccountId: 'ar', sourceType: 'TEST', sourceId: '1', lines: [], createdAt: '2026-10-01' },
    { id: 's', type: 'SUPPLIER', status: 'POSTED', partyId: 'مورد-1', number: 'SUP-2', postingDate: '2026-10-02', currency: 'EGP', baseTotal: '200.00', outstanding: '200.00', controlAccountId: 'cash', sourceType: 'TEST', sourceId: '2', lines: [], createdAt: '2026-10-02' },
  ],
  treasuries: [{ id: 't', code: 'CASH', name: 'الخزنة الرئيسية', type: 'CASH', currency: 'EGP', glAccountId: 'cash', active: true }],
  vouchers: [{ id: 'v', treasuryId: 't', kind: 'RECEIPT', partyKind: 'CUSTOMER', partyId: 'عميل-1', number: 'REC-1', postingDate: '2026-10-01', currency: 'EGP', amount: '75.00', status: 'POSTED', sourceType: 'TEST', sourceId: '1', allocationIds: ['allocation-1'] }],
  taxPolicies: [{ id: 'tax0', code: 'VAT14', effectiveFrom: '2026-01-01', rate: '14', outputAccountId: 'cash', inputAccountId: 'cash' }],
  approvalPolicies: [],
  approvalRequests: [],
  controlIssues: [],
  reports: { trialBalance: { rows: [] }, incomeStatement: { rows: [] }, balanceSheet: { rows: [] }, treasury: { totals: [] }, tax: { totals: [], facts: [] } },
};
const props: AccountingPresentationProps = { data, capabilities: { read: true, operate: true }, notice: '', reload: async () => {} };
const html = (page: ComponentType<AccountingPresentationProps>) => renderToStaticMarkup(createElement(page, props));

test('all nineteen routes have distinct business-facing compositions', () => {
  const cases: [ComponentType<AccountingPresentationProps>, string, string][] = [
    [AccountingLandingPage, 'أقسام المحاسبة', 'الاستحقاقات'], [InvoicesPage, 'المبيعات', 'المشتريات'], [ReceiptsPage, 'كل المقبوضات', 'مخصص'], [PaymentsPage, 'كل المدفوعات', 'إلى'], [ExpensesPage, 'إدارة التصنيفات', 'المعالجة'], [SettlementsPage, 'تسويات الموردين', 'تسويات العملاء'], [AccrualsPage, 'الإيرادات المؤجلة', 'مسيرات الرواتب'], [ChequesPage, 'قيد التحصيل / الصرف', 'حساب البنك'], [TreasuryPage, 'التحويلات', 'المطابقة البنكية'], [CurrenciesPage, 'إعادة تقييم العملات', 'إعادات التقييم'], [TaxesPage, 'كود ضريبة', 'مدخلات'], [PeriodsPage, 'السنوات المالية', 'فترات السنة الحالية'], [JournalPage, 'مسودات القيود اليدوية', 'القوالب المتكررة'], [AccountsPage, 'دليل الحسابات', 'حساب / مجموعة'], [TrialPage, 'حالة الاتزان', 'إجمالي المدين'], [CostCentersPage, 'مراكز التكلفة', 'الانحراف'], [AssetsPage, 'الأصول الثابتة', 'مجمع الإهلاك'], [LoansPage, 'القروض والتمويلات', 'المخصصات'], [BudgetsPage, 'الموازنات التقديرية', 'الفعلي'],
  ];
  for (const [page, first, second] of cases) {
    const output = html(page);
    assert.match(output, new RegExp(first), page.name);
    assert.match(output, new RegExp(second), page.name);
    assert.match(output, /accounting-route/, page.name);
  }
});

test('invoice, receipt, account and treasury screens render canonical target data in different tables', () => {
  assert.match(html(InvoicesPage), /INV-1/);
  assert.match(html(ReceiptsPage), /REC-1/);
  assert.match(html(AccountsPage), /1100/);
  assert.match(html(TreasuryPage), /الخزنة الرئيسية/);
  assert.doesNotMatch(html(PaymentsPage), /REC-1/);
});

test('invoice tab behavior switches the canonical data set and create semantics', () => {
  const sales = invoicesForTab(data.invoices, 'sales');
  const purchases = invoicesForTab(data.invoices, 'purchases');
  assert.deepEqual(sales.map((row) => row.number), ['INV-1']);
  assert.deepEqual(purchases.map((row) => row.number), ['SUP-2']);
  const initial = html(InvoicesPage);
  assert.match(initial, /فاتورة مبيعات/);
  assert.match(initial, /INV-1/);
  assert.doesNotMatch(initial, /SUP-2/);
});

test('sales invoice create renders the deep legacy workflow rather than the compact generic form', () => {
  const output = html(InvoicesPage);
  for (const label of [
    'فاتورة مبيعات',
    'كل بند يمكن أن يحمل حسابًا ومركز تكلفة وضريبة مختلفة',
    'العميل / المندوب',
    'تاريخ تنفيذ / استحقاق الإيراد',
    'طريقة الحفظ',
    'حفظ مسودة',
    'تأكيد وترحيل',
    'شروط الدفع / ملاحظات',
    'بنود الفاتورة',
    'البيان',
    'الكمية',
    'السعر',
    'نوع الخصم',
    'الخصم',
    'الضريبة',
    'الحساب',
    'مركز التكلفة',
    'حفظ الفاتورة',
  ]) assert.match(output, new RegExp(label), label);
  assert.match(output, /legacy-invoice-dialog/);
  assert.match(output, /4100/);
  assert.match(output, /VAT14/);
});

test('sales invoice compatibility gate never silently drops unsupported legacy semantics', () => {
  const base: SalesInvoiceDraft = {
    postingDate: '2026-10-02',
    party: { kind: 'CUSTOMER', partyId: 'party-1', number: 'C-1', displayName: 'عميل اختبار' },
    partyQuery: 'عميل اختبار',
    currency: 'EGP',
    dueDate: '2026-10-02',
    recognitionDate: '',
    saveMode: 'POSTED',
    paymentTerms: '',
    lines: [{ id: 'line-1', description: '', quantity: '1', price: '100', discountMode: 'FIXED', discount: '0', taxCode: '', accountId: 'revenue', costCenterId: '' }],
  };
  assert.equal(salesInvoiceCompatibilityIssue(base), undefined);
  assert.match(salesInvoiceCompatibilityIssue({ ...base, saveMode: 'DRAFT' }) ?? '', /مسودة/);
  assert.match(salesInvoiceCompatibilityIssue({ ...base, paymentTerms: '30 يوم' }) ?? '', /شروط الدفع/);
  assert.match(salesInvoiceCompatibilityIssue({ ...base, lines: [{ ...base.lines[0]!, description: 'برنامج عمرة' }] }) ?? '', /بيان بند/);
  assert.match(salesInvoiceCompatibilityIssue({ ...base, lines: [{ ...base.lines[0]!, quantity: '2' }] }) ?? '', /الكمية/);
  assert.match(salesInvoiceCompatibilityIssue({ ...base, lines: [{ ...base.lines[0]!, discount: '10' }] }) ?? '', /خصم/);
  assert.match(salesInvoiceCompatibilityIssue({ ...base, lines: [{ ...base.lines[0]!, costCenterId: 'cc-1' }] }) ?? '', /مركز تكلفة/);
});

test('treasury tab behavior has three exclusive business panels', () => {
  assert.deepEqual((['accounts', 'transfers', 'reconciliation'] as const).map(treasuryTabLabel), ['الحسابات', 'التحويلات', 'المطابقة البنكية']);
  const initial = html(TreasuryPage);
  assert.match(initial, /الخزنة الرئيسية/);
  assert.doesNotMatch(initial, /لا يعرض عقد الملخص الحالي قائمة التحويلات/);
  assert.doesNotMatch(initial, /اختر بنكًا واستورد كشفًا/);
});

test('search and sorting filter canonical rows without calculating financial truth', () => {
  const rows = filterAndSortRows(data.invoices, { query: 'مورد', sort: 'desc' }, (row) => [row.number, row.partyId, row.postingDate], (row) => `${row.postingDate}-${row.number}`);
  assert.deepEqual(rows.map((row) => row.number), ['SUP-2']);
  const ordered = filterAndSortRows(data.invoices, { query: '', sort: 'asc' }, (row) => [row.number], (row) => `${row.postingDate}-${row.number}`);
  assert.deepEqual(ordered.map((row) => row.number), ['INV-1', 'SUP-2']);
});

test('invoice rows expose supported and blocked legacy actions explicitly', () => {
  const output = html(InvoicesPage);
  for (const label of ['تحصيل', 'طباعة', 'إشعار دائن/مدين', 'إلغاء']) assert.match(output, new RegExp(label));
  assert.match(output, /BLOCKED-BY-BACKEND/);
});
