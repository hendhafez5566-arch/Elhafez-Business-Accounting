import assert from'node:assert/strict';
import test from'node:test';
import{readFile}from'node:fs/promises';

test('reporting center exposes financial operational saved-report and scheduling workspaces without browser prompts',async()=>{
 const[routes,page,client]=await Promise.all([
  readFile(new URL('./routes.tsx',import.meta.url),'utf8'),
  readFile(new URL('./reporting-center-page.tsx',import.meta.url),'utf8'),
  readFile(new URL('./reporting-center-client.ts',import.meta.url),'utf8'),
 ]);
 assert.ok(routes.includes('/management/reports'));
 for(const required of ['مركز التقارير','تقارير مالية','تقارير تشغيلية','التقارير المحفوظة والجدولة','طباعة / PDF','تصدير CSV لفتح Excel'])assert.match(page,new RegExp(required));
 for(const forbidden of ['window.prompt','window.confirm','window.alert'])assert.ok(!page.includes(forbidden),forbidden+' must not be used');
 assert.match(client,/operational-reporting\/saved-reports/);
 assert.match(client,/operational-reporting\/schedules/);
 assert.match(client,/managementControlApi\.overview/);
 assert.match(client,/accountingApi\.overview/);
});
