import assert from'node:assert/strict';
import test from'node:test';
import{readFile}from'node:fs/promises';
import{foundationRoutes}from'./routes.js';

async function source(name:string){return readFile(new URL('./'+name,import.meta.url),'utf8');}

test('legacy parity closure restores clean deep navigation without duplicate route ownership',()=>{
 const paths=foundationRoutes.map(route=>route.path);
 for(const path of[
  '/system/readiness','/system/quick-start','/system/period-archive',
  '/system-administration/users','/system-administration/branches','/system-administration/documents',
  '/accounting/invoices','/accounting/receipts-payments','/accounting/treasury','/accounting/journals',
  '/accounting/chart','/accounting/trial-reports','/accounting/currency','/accounting/tax','/accounting/periods','/accounting/controls',
 ])assert.ok(paths.includes(path),path);
 assert.equal(new Set(paths).size,paths.length);
});

test('Hajj and Umrah program authoring uses structured ERP controls instead of raw JSON',async()=>{
 const page=await source('hajj-umrah-pages.tsx');
 assert.match(page,/خط سير البرنامج والخدمات/);
 assert.match(page,/مكونات الباقة المطلوبة/);
 assert.match(page,/إضافة محطة \/ خدمة/);
 assert.ok(!page.includes('المكونات JSON'));
});

test('booking creation uses business pickers instead of asking operators for internal IDs',async()=>{
 const hajj=await source('hajj-umrah-operations-primary-pages.tsx');
 const tourism=await source('tourism-operations-page.tsx');
 assert.match(hajj,/EntityPicker kind="HAJJ_PROGRAM"/);
 assert.match(hajj,/EntityPicker kind="CUSTOMER"/);
 assert.match(hajj,/EntityMultiPicker kind="TRAVELER"/);
 assert.ok(!hajj.includes('معرّف البرنامج'));
 assert.ok(!hajj.includes('معرّف العميل'));
 assert.ok(!hajj.includes('معرّفات المسافرين'));
 assert.match(tourism,/EntityPicker kind="CUSTOMER"/);
 assert.match(tourism,/EntityMultiPicker kind="TRAVELER"/);
 assert.ok(!tourism.includes('معرّف العميل'));
});

test('touched commercial pages do not use browser prompt confirm or alert patching',async()=>{
 for(const file of['crm-core-pages.tsx','quotation-pages.tsx','supplier-pages.tsx']){
  const page=await source(file);
  for(const forbidden of['window.prompt','window.confirm','window.alert'])assert.ok(!page.includes(forbidden),file+' contains '+forbidden);
 }
});

test('canonical accounting workspace surfaces treasury operations present in the legacy product',async()=>{
 const page=await source('accounting-workspace-page.tsx');
 for(const label of['تحويل بين الخزن والبنوك','إصدار ومتابعة الشيكات','جرد الخزينة','المطابقة البنكية'])assert.match(page,new RegExp(label));
 const client=await source('accounting-client.ts');
 for(const operation of['treasuryTransfers','transferTreasury','issueTreasuryCheque','recordTreasuryCashCount','treasuryBankLines','manualMatchTreasuryBankLine'])assert.match(client,new RegExp(operation));
});

test('customer commercial terms remain visible while finance ownership stays in accounting',async()=>{
 const crm=await source('crm-core-pages.tsx');
 for(const label of['حد الائتمان','أيام الائتمان','شروط الدفع'])assert.match(crm,new RegExp(label));
 assert.ok(!crm.includes('رصيد حساب'));
});
