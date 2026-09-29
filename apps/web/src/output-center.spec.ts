import assert from'node:assert/strict';
import test from'node:test';
import{readFile}from'node:fs/promises';

test('output center centralizes legacy outputs without duplicating document ownership',async()=>{
 const page=await readFile(new URL('./output-center-page.tsx',import.meta.url),'utf8');
 for(const label of ['مركز المخرجات','عروض الأسعار','كشف حساب عميل / مورد','Rooming List','Manifest / Flight Outputs','Transport Orders','Hotel / Service Vouchers','Supplier Dues / Procurement','الاستحقاقات والتنبيهات التشغيلية'])assert.ok(page.includes(label),label);
 for(const route of ['/crm/quotations','/management/reports','/tourism/bookings','/hajj-umrah/rooming','/hajj-umrah/ticketing','/hajj-umrah/transport','/tourism/services','/procurement/purchase-orders'])assert.ok(page.includes(route),route);
 assert.ok(page.includes('managementControlApi.overview'));
});
