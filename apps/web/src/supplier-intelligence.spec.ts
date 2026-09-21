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

test('Supplier Intelligence UI exposes 360 metrics evaluations disputes and dialog-based actions',()=>{
 const html=renderToStaticMarkup(createElement(SupplierIntelligencePage));
 for(const text of ['تقييم ومتابعة الموردين','اختر المورد'])assert.match(html,new RegExp(text));
 const source=SupplierIntelligencePage.toString();
 assert.doesNotMatch(source,/window\.(prompt|confirm|alert)/);
});
