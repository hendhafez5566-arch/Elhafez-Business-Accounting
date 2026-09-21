import assert from'node:assert/strict';
import test from'node:test';
import{createElement}from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{foundationRoutes,findRoute}from'./routes.js';
import{SupplierIntelligencePage}from'./supplier-intelligence-page.js';

test('Arabic Supplier Intelligence route is registered once',()=>{
 const route=findRoute('/procurement/supplier-intelligence');
 assert.equal(route.id,'supplier-intelligence');
 assert.equal(route.label,'تقييم ومتابعة الموردين');
 assert.equal(foundationRoutes.filter(item=>item.path==='/procurement/supplier-intelligence').length,1);
});

test('Supplier Intelligence UI exposes required 360, metrics, evaluation, dispute and hold flows without browser prompts',()=>{
 const html=renderToStaticMarkup(createElement(SupplierIntelligencePage));
 for(const text of ['تقييم ومتابعة الموردين','اختر المورد'])assert.match(html,new RegExp(text));
 const source=SupplierIntelligencePage.toString();
 for(const text of ['Supplier 360','أداء المشتريات','إضافة تقييم','فتح نزاع','رفع Hold','نشط','غير نشط','موقوف مؤقتًا'])assert.match(source,new RegExp(text));
 assert.doesNotMatch(source,/window\.(prompt|confirm|alert)/);
});
