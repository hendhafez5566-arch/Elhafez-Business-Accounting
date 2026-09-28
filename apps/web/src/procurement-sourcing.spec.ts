import assert from'node:assert/strict';
import test from'node:test';
import{readFile}from'node:fs/promises';

test('procurement sourcing workspace exposes the pre-PO lifecycle without browser prompt shortcuts',async()=>{
 const[routes,page]=await Promise.all([
  readFile(new URL('./routes.tsx',import.meta.url),'utf8'),
  readFile(new URL('./procurement-sourcing-page.tsx',import.meta.url),'utf8'),
 ]);
 assert.match(routes,/\/procurement\/sourcing/);
 for(const required of ['طلبات الشراء','طلبات عروض الأسعار والمقارنة','الترسيات','إرسال للاعتماد','تسجيل عرض مورد','قرار الترسية','إنشاء أمر الشراء'])assert.match(page,new RegExp(required));
 for(const forbidden of ['window.prompt','window.confirm','window.alert'])assert.ok(!page.includes(forbidden),forbidden+' must not be used');
 assert.match(page,/procurement-sourcing\/requisitions/);
 assert.match(page,/procurement-sourcing\/rfqs/);
 assert.match(page,/procurement-sourcing\/awards/);
 assert.match(page,/المقارنة لا تختار الفائز تلقائيًا/);
});
