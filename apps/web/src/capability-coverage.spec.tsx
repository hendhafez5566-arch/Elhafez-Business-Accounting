import assert from'node:assert/strict';
import test from'node:test';
import{createElement}from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{AccountingCapabilitiesPage,TourismContractsInventoryPage}from'./capability-coverage-pages.js';
import{findRoute}from'./routes.js';

test('frontend coverage routes expose previously hidden operational capabilities',()=>{
 const cases=[
  ['/tourism/contracts-inventory','التعاقدات والمخزون'],
  ['/accounting/currency','العملات وأسعار الصرف'],
  ['/accounting/cost-budget','مراكز التكلفة والموازنات'],
  ['/accounting/party-netting','حسابات الأطراف والمقاصة'],
  ['/accounting/expenses-commissions','المصروفات والعمولات'],
  ['/accounting/assets-financing','الأصول والتمويل'],
  ['/tourism/travelers','المسافرون'],
  ['/hajj-umrah/travelers','المسافرون'],
 ] as const;
 for(const[path,label]of cases){const route=findRoute(path);assert.equal(route.path,path);assert.equal(route.label,label);assert.notEqual(route.navigation,false);}
});

test('contracts and inventory workspace is Arabic-first and exposes owner-backed workflows',()=>{
 const html=renderToStaticMarkup(createElement(TourismContractsInventoryPage));
 assert.match(html,/التعاقدات والمخزون/);
 assert.match(html,/العقود/);
 assert.match(html,/السعات والمخزون/);
 assert.match(html,/التخصيصات/);
 assert.match(html,/مالك الحقيقة/);
});

test('advanced accounting capabilities render each owner-backed workspace',()=>{
 for(const[tab,label]of[
  ['currency','العملات وأسعار الصرف'],
  ['cost','مراكز التكلفة والموازنات'],
  ['parties','حسابات الأطراف والمقاصة'],
  ['expenses','المصروفات والعمولات'],
  ['assets','الأصول والتمويل'],
 ] as const){
  const html=renderToStaticMarkup(createElement(AccountingCapabilitiesPage,{initialTab:tab}));
  assert.match(html,new RegExp(label));
 }
});
