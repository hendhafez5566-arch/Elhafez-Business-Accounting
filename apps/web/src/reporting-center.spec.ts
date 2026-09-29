import assert from'node:assert/strict';
import test from'node:test';
import{readFile}from'node:fs/promises';

test('reporting center exposes scoped financial operational saved-report and scheduling workspaces without browser prompts',async()=>{
 const[routes,page,client]=await Promise.all([
  readFile(new URL('./routes.tsx',import.meta.url),'utf8'),
  readFile(new URL('./reporting-center-page.tsx',import.meta.url),'utf8'),
  readFile(new URL('./reporting-center-client.ts',import.meta.url),'utf8'),
 ]);
 assert.ok(routes.includes('/management/reports'));
 for(const required of ['مركز التقارير','تقارير مالية','تقارير تشغيلية','التقارير المحفوظة والجدولة','طباعة / PDF','تصدير CSV لفتح Excel','أعمار ديون العملاء','أعمار ديون الموردين','ربحية البرامج','مشكلات الرقابة المالية','من تاريخ','إلى تاريخ','كما في','تطبيق النطاق','فتح'])assert.match(page,new RegExp(required));
 for(const forbidden of ['window.prompt','window.confirm','window.alert'])assert.ok(!page.includes(forbidden),forbidden+' must not be used');
 assert.match(page,/savedScope/);
 assert.match(page,/programId/);
 assert.match(page,/controlIssues/);
 assert.match(page,/openSaved/);
 for(const endpoint of ['/operational-reporting/saved-reports','/operational-reporting/schedules','/accounting/reports/statements','/accounting/reports/aging','/accounting/reports/treasury','/accounting/reports/tax','/accounting/reports/program','/accounting/reports/supplier','/tourism/programs','/hajj-umrah/programs'])assert.ok(client.includes(endpoint),endpoint);
 assert.match(client,/managementControlApi\.overview/);
 assert.match(client,/accountingApi\.overview/);
 assert.match(client,/Promise\.allSettled/);
 assert.match(client,/q\.set\('from'/);
 assert.match(client,/q\.set\('to'/);
 assert.match(client,/q\.set\('asOf'/);
});
