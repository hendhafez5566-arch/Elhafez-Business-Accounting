import assert from'node:assert/strict';
import test from'node:test';
import{readFile}from'node:fs/promises';

test('reporting center exposes scoped financial operational control party-statement saved-report and scheduling workspaces without browser prompts',async()=>{
 const[routes,page,client,accountingClient]=await Promise.all([
  readFile(new URL('./routes.tsx',import.meta.url),'utf8'),
  readFile(new URL('./reporting-center-page.tsx',import.meta.url),'utf8'),
  readFile(new URL('./reporting-center-client.ts',import.meta.url),'utf8'),
  readFile(new URL('./accounting-client.ts',import.meta.url),'utf8'),
 ]);
 assert.ok(routes.includes('/management/reports'));
 for(const required of ['مركز التقارير','تقارير مالية','تقارير تشغيلية ورقابية','التقارير المحفوظة والجدولة','كشوف العملاء والموردين','كشف حساب عميل','كشف حساب مورد','الأرصدة والمراكز المفتوحة الحالية','الحركة التفصيلية','التسويات','دفعة مقدمة','طباعة / PDF','تصدير CSV لفتح Excel','أعمار ديون العملاء','أعمار ديون الموردين','ربحية البرامج','مشكلات الرقابة المالية','سجل التسويات الرقابية','جاهزية الإقفال','سجل التدقيق للفرع','من تاريخ','إلى تاريخ','كما في','تطبيق النطاق','فتح'])assert.match(page,new RegExp(required));
 for(const forbidden of ['window.prompt','window.confirm','window.alert'])assert.ok(!page.includes(forbidden),forbidden+' must not be used');
 assert.match(page,/savedScope/);
 assert.match(page,/programId/);
 assert.match(page,/partyMovements/);
 assert.match(page,/partyAging/);
 assert.match(page,/allocationIds/);
 assert.match(page,/advanceId/);
 assert.match(page,/financialHistory/);
 assert.match(page,/controlIssues/);
 assert.match(page,/openSaved/);
 assert.match(client,/CUSTOMER_STATEMENT/);
 assert.match(client,/SUPPLIER_STATEMENT/);
 assert.match(accountingClient,/allocationIds/);
 assert.match(accountingClient,/advanceId/);
 assert.match(accountingClient,/sourceType/);
 for(const endpoint of ['/management-control/financial-history','/operational-reporting/saved-reports','/operational-reporting/schedules','/report-delivery/schedules/','/run-now','/accounting/reports/statements','/accounting/reports/aging','/accounting/reports/treasury','/accounting/reports/tax','/accounting/reports/program','/accounting/reports/supplier','/tourism/programs','/hajj-umrah/programs'])assert.ok(client.includes(endpoint),endpoint);
 assert.match(client,/managementControlApi\.overview/);
 assert.match(client,/accountingApi\.overview/);
 assert.match(client,/Promise\.allSettled/);
 assert.match(client,/q\.set\('from'/);
 assert.match(client,/q\.set\('to'/);
 assert.match(client,/q\.set\('asOf'/);
});