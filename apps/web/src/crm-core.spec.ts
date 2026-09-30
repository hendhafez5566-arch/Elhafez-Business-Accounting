import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FollowupsPage, LeadsPage } from './crm-core-pages.js';
import { CustomersPage } from './crm-party-pages.js';
import { Customer360Page } from './crm-360-parity-pages.js';
import { AgentsPage } from './crm-agent-parity-pages.js';
import { foundationRoutes } from './routes.js';

test('CRM registers the complete Arabic-first sales/customer workspace without duplicate visible routes', () => {
  const paths=foundationRoutes.map((route)=>route.path);
  for(const path of ['/crm/dashboard','/crm/customers','/crm/customer-360','/crm/customer-documents','/crm/agents','/crm/agent-360','/crm/agent-documents','/crm/leads','/crm/followups','/crm/quotations','/crm/financial-action'])assert.ok(paths.includes(path),path);
  assert.equal(new Set(paths).size,paths.length);
  assert.equal(foundationRoutes.find(route=>route.path==='/crm/agents')?.label,'المندوبون');
  assert.equal(foundationRoutes.find(route=>route.path==='/crm/financial-action')?.navigation,false);
});

test('customer and agent pages keep commercial ownership in CRM while exposing owner-backed operational workspaces', () => {
  const customers=renderToStaticMarkup(createElement(CustomersPage));
  const agents=renderToStaticMarkup(createElement(AgentsPage));
  assert.match(customers,/إضافة عميل/);
  assert.match(customers,/نوع العميل/);
  assert.match(customers,/كل الأنواع/);
  assert.match(customers,/عملاء موقوفون/);
  assert.match(customers,/ملاحظات تجارية/);
  assert.doesNotMatch(customers,/حد ائتماني|حساب مراقبة المدينين/);
  assert.match(agents,/إضافة مندوب/);
  assert.match(agents,/نوع العمولة الافتراضية/);
  assert.match(agents,/لهم عمولات مستحقة/);
  assert.doesNotMatch(agents,/حساب مراقبة المدينين/);
});

test('customer 360 selects a human-readable customer instead of asking employees for a raw internal id', () => {
  const customer360=renderToStaticMarkup(createElement(Customer360Page));
  assert.match(customer360,/اختر العميل بالاسم أو الرقم/);
  assert.match(customer360,/عرض الملف الموحد/);
  assert.doesNotMatch(customer360,/معرّف العميل/);
});

test('lead and follow-up pages expose the expanded pipeline and scheduling surfaces', () => {
  const leads=renderToStaticMarkup(createElement(LeadsPage));
  const followups=renderToStaticMarkup(createElement(FollowupsPage));
  assert.match(leads,/العملاء المحتملون والمتابعة/);
  assert.match(leads,/إضافة عميل محتمل/);
  assert.match(leads,/المندوب المحيل/);
  assert.match(leads,/مسار المبيعات/);
  assert.match(followups,/جدولة متابعة/);
  assert.match(followups,/متأخرة/);
  assert.match(followups,/واتساب/);
});