import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Agent360Page } from './crm-agent-parity-pages.js';
import { CrmSalesDashboardPage } from './crm-dashboard-parity-page.js';
import { Customer360Page } from './crm-360-parity-pages.js';
import { TravelersPage } from './crm-insights-pages.js';
import { QuotationsPage } from './quotation-pages.js';
import { findRoute, foundationRoutes } from './routes.js';

test('CS-03 browser routes are registered once and reachable through the existing shell seam',()=>{
  for(const [path,id] of [['/crm/dashboard','crm-dashboard'],['/crm/customer-360','crm-customer-360'],['/crm/agent-360','crm-agent-360'],['/crm/travelers','crm-travelers']] as const){
    assert.equal(findRoute(path).id,id);
    assert.equal(foundationRoutes.filter(route=>route.path===path).length,1);
  }
});

test('CS-03 CRM composition pages render Arabic-first operational surfaces without becoming financial editors',()=>{
  const dashboard=renderToStaticMarkup(createElement(CrmSalesDashboardPage));
  const customer=renderToStaticMarkup(createElement(Customer360Page));
  const agent=renderToStaticMarkup(createElement(Agent360Page));
  const travelers=renderToStaticMarkup(createElement(TravelersPage));
  assert.match(dashboard,/جارٍ تحميل/);
  assert.match(customer,/ملف العميل 360°/);
  assert.match(agent,/ملف المندوب 360°/);
  assert.match(travelers,/إضافة مسافر/);
  assert.doesNotMatch(customer,/إنشاء قيد|تسجيل دفعة/);
  assert.doesNotMatch(agent,/صرف عمولة|تسجيل قيد/);
});

test('quotation UI exposes print PDF WhatsApp and immutable communication history surfaces',()=>{
  const markup=renderToStaticMarkup(createElement(QuotationsPage));
  assert.match(markup,/حفظ PDF/);
  assert.match(markup,/واتساب/);
  assert.match(markup,/سجل الإرسال والتصدير/);
});
