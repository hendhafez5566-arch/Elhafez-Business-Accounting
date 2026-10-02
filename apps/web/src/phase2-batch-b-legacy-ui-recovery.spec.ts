import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const count = (text: string, token: string) => text.split(token).length - 1;

test('Hajj and Umrah restores the legacy operating dashboard without replacing canonical transaction owners', () => {
  const routes = source('./routes.tsx');
  const dashboard = source('./hajj-umrah-dashboard-page.tsx');

  assert.equal(count(routes, "path: '/hajj-umrah'"), 1);
  for (const token of [
    "path: '/hajj-umrah/seasons'",
    "path: '/hajj-umrah/programs'",
    "path: '/hajj-umrah/bookings'",
    "path: '/hajj-umrah/rooming'",
    "path: '/hajj-umrah/visas'",
    "path: '/hajj-umrah/ticketing'",
    "path: '/hajj-umrah/transport'",
    "path: '/hajj-umrah/trip-operations'",
    "path: '/hajj-umrah/readiness'",
  ]) assert.equal(count(routes, token), 1, token);

  for (const label of [
    'برامج مفتوحة للبيع',
    'حجوزات قيد العمل',
    'حجوزات مؤقتة',
    'مشاكل تشغيل مفتوحة',
    'إنشاء برنامج حج/عمرة',
    'إنشاء حجز حج/عمرة',
    'استكمال حجز موجود',
    'تجهيز وتشغيل فوج',
    'خطة العمل الحالية',
    'أقرب برامج سفر',
  ]) assert.match(dashboard, new RegExp(label));

  assert.doesNotMatch(routes, /\/manage(?:['"/])/);
});

test('Accounting legacy routes use route-owned Phase 3 presentations backed by canonical read APIs', () => {
  const routes = source('./accounting-legacy-routes.tsx');
  const adapter = source('./accounting-legacy-route-page.tsx');
  const expected = [
    '/accounting/invoices', '/accounting/receipts', '/accounting/payments', '/accounting/expenses',
    '/accounting/settlements', '/accounting/accruals', '/accounting/cheques', '/accounting/treasury',
    '/accounting/currencies', '/accounting/taxes', '/accounting/periods', '/accounting/journal',
    '/accounting/accounts', '/accounting/trial', '/accounting/costcenters', '/accounting/assets',
    '/accounting/loans', '/accounting/budgets',
  ];
  for (const path of expected) assert.equal(count(routes, `'${path}'`), 1, path);
  for (const page of ['InvoicesPage','ReceiptsPage','PaymentsPage','ExpensesPage','SettlementsPage','AccrualsPage','ChequesPage','TreasuryPage','CurrenciesPage','TaxesPage','PeriodsPage','JournalPage','AccountsPage','TrialPage','CostCentersPage','AssetsPage','LoansPage','BudgetsPage']) assert.match(routes, new RegExp(page));
  assert.doesNotMatch(adapter, /AccountingWorkspaceView|AccountingSectionContent/);
  assert.match(adapter, /accountingApi\.capabilities\(\)/);
  assert.match(adapter, /accountingApi\.overview\(\)/);
  assert.doesNotMatch(adapter, /localStorage|sessionStorage|\bany\b|ts-ignore/);
});

test('Accounting Phase 3 adapter keeps one canonical loader without a generic workspace visual substitute', () => {
  const adapter = source('./accounting-legacy-route-page.tsx');
  const pages = source('./pages/accounting/accounting-pages.tsx');
  assert.equal(count(adapter, 'accountingApi.overview()'), 1);
  assert.equal(count(adapter, 'accountingApi.capabilities()'), 1);
  assert.doesNotMatch(adapter + pages, /AccountingWorkspaceView|AccountingSectionContent/);
  assert.match(pages, /export function InvoicesPage/);
  assert.match(pages, /export function TreasuryPage/);
  assert.match(pages, /export function TrialPage/);
});
