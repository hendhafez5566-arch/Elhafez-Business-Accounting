import assert from'node:assert/strict';
import test from'node:test';
import{readFile}from'node:fs/promises';

test('approval center is a dedicated Arabic composition route without prompt patching',async()=>{
 const[routes,page,client]=await Promise.all([
  readFile(new URL('./routes.tsx',import.meta.url),'utf8'),
  readFile(new URL('./approval-center-page.tsx',import.meta.url),'utf8'),
  readFile(new URL('./approval-center-client.ts',import.meta.url),'utf8'),
 ]);
 assert.ok(routes.includes('/management/approvals'));
 assert.match(page,/مركز الموافقات/);
 assert.match(page,/بانتظار القرار/);
 assert.match(page,/سياسات الموافقة/);
 for(const forbidden of ['window.prompt','window.confirm','window.alert'])assert.ok(!page.includes(forbidden),forbidden+' must not be used');
 assert.match(client,/accounting\/controls\/approvals/);
 assert.match(client,/crm\/quotations/);
});
