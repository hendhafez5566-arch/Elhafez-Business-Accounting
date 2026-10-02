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

test('Accounting legacy entry routes all reuse the accepted canonical AccountingWorkspaceView', () => {
  const routes = source('./routes.tsx');
  const adapter = source('./accounting-legacy-route-page.tsx');
  const expected = [
    '/accounting/invoices', '/accounting/receipts', '/accounting/payments', '/accounting/expenses',
    '/accounting/settlements', '/accounting/accruals', '/accounting/cheques', '/accounting/treasury',
    '/accounting/currencies', '/accounting/taxes', '/accounting/periods', '/accounting/journal',
    '/accounting/accounts', '/accounting/trial', '/accounting/cost-centers', '/accounting/assets',
    '/accounting/loans', '/accounting/budgets',
  ];
  for (const path of expected) assert.equal(count(routes, `path: '${path}'`), 1, path);
  assert.match(adapter, /AccountingWorkspaceView/);
  assert.match(adapter, /accountingApi\.capabilities\(\)/);
  assert.match(adapter, /accountingApi\.overview\(\)/);
  assert.doesNotMatch(adapter, /localStorage|sessionStorage|\bany\b|ts-ignore/);
});

test('Accounting route adapter exposes the existing canonical financial sections rather than reimplementing them', () => {
  const routes = source('./routes.tsx');
  const pairs = [
    ["/accounting/invoices", 'billing'],
    ["/accounting/receipts", 'treasury'],
    ["/accounting/payments", 'treasury'],
    ["/accounting/expenses", 'expense-commission'],
    ["/accounting/accruals", 'recognition-accrual'],
    ["/accounting/currencies", 'currency-fx'],
    ["/accounting/taxes", 'tax'],
    ["/accounting/periods", 'periods'],
    ["/accounting/journal", 'journals'],
    ["/accounting/accounts", 'accounts'],
    ["/accounting/trial", 'reports'],
    ["/accounting/assets", 'assets-financing'],
    ["/accounting/budgets", 'cost-budget'],
  ] as const;
  for (const [path, section] of pairs) {
    const line = routes.split('\n').find((row) => row.includes(`path: '${path}'`));
    assert.ok(line, path);
    assert.match(line, new RegExp(`initialSection=\\"${section}\\"`));
  }
});
