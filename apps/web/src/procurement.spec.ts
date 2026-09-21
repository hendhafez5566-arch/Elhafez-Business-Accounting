import assert from'node:assert/strict';
import test from'node:test';
import{createElement}from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{ProcurementOperationsPage}from'./procurement-pages.js';
import{foundationRoutes,findRoute}from'./routes.js';

test('SP-02 purchase-order route is registered once under procurement workspace',()=>{
 const route=findRoute('/procurement/purchase-orders');
 assert.equal(route.id,'procurement-operations');
 assert.equal(route.label,'أوامر الشراء');
 assert.equal(route.group,'المشتريات والموردون');
 assert.equal(foundationRoutes.filter((item)=>item.path==='/procurement/purchase-orders').length,1);
});

test('procurement operations page exposes PO, fulfillment and direct-purchase surfaces',()=>{
 const html=renderToStaticMarkup(createElement(ProcurementOperationsPage));
 assert.match(html,/أمر شراء جديد/);
 assert.match(html,/أوامر الشراء/);
 assert.match(html,/شراء مباشر/);
});
