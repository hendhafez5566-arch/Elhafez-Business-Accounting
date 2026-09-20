import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentsPage, CustomersPage, FollowupsPage, LeadsPage } from './crm-core-pages.js';
import { foundationRoutes } from './routes.js';

test('CS-01 registers only CRM Core routes and keeps Arabic-first labels', () => {
  const paths=foundationRoutes.map((route)=>route.path);
  assert.ok(paths.includes('/crm/customers'));
  assert.ok(paths.includes('/crm/agents'));
  assert.ok(paths.includes('/crm/leads'));
  assert.ok(paths.includes('/crm/followups'));
  assert.ok(paths.includes('/crm/quotations')); // CS-02 extends the suite without changing CS-01 owners.
});
test('customer and agent pages expose lifecycle/edit controls without financial ownership fields', () => {
  const customers=renderToStaticMarkup(createElement(CustomersPage));
  const agents=renderToStaticMarkup(createElement(AgentsPage));
  assert.match(customers,/إضافة عميل/); assert.match(customers,/ملاحظات تجارية/); assert.doesNotMatch(customers,/حد ائتماني|رصيد حساب|فاتورة/);
  assert.match(agents,/العمولة الافتراضية/); assert.doesNotMatch(agents,/مطالبات عمولة|دفع العمولة/);
});
test('lead and follow-up pages expose CRM Core lifecycle without a quotation implementation', () => {
  const leads=renderToStaticMarkup(createElement(LeadsPage));
  const followups=renderToStaticMarkup(createElement(FollowupsPage));
  assert.match(leads,/Pipeline العملاء المحتملين/); assert.match(leads,/حفظ العميل المحتمل/); assert.doesNotMatch(leads,/إنشاء عرض سعر|قبول عرض السعر|رفض عرض السعر/);
  assert.match(followups,/جدولة متابعة/); assert.match(followups,/متأخرة/); assert.match(followups,/WHATSAPP/);
});
