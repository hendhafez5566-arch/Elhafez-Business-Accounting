import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvancedAccountingPage, ContractInventoryPage } from './advanced-operations-pages.js';
import { findRoute } from './routes.js';

test('advanced accounting surfaces render every approved hidden financial capability',()=>{
  const html=renderToStaticMarkup(createElement(AdvancedAccountingPage));
  for(const text of ['العملات وأسعار الصرف','مراكز التكلفة والموازنات','حسابات الأطراف والمقاصة','المصروفات والعمولات والاستحقاقات','الأصول والتمويل'])assert.match(html,new RegExp(text));
});

test('contracts and inventory is exposed in Tourism and Hajj/Umrah without duplicating the owner',()=>{
  const html=renderToStaticMarkup(createElement(ContractInventoryPage));
  assert.match(html,/التعاقدات والمخزون/);
  assert.match(html,/Tourism Contract Inventory/);
  assert.equal(findRoute('/tourism/contracts-inventory').label,'التعاقدات والمخزون');
  assert.equal(findRoute('/hajj-umrah/contracts-inventory').label,'التعاقدات والمخزون');
});

test('traveler capability is reachable from CRM, Tourism and Hajj/Umrah presentation suites',()=>{
  assert.equal(findRoute('/crm/travelers').label,'المسافرون');
  assert.equal(findRoute('/tourism/travelers').label,'المسافرون');
  assert.equal(findRoute('/hajj-umrah/travelers').label,'المسافرون');
});

test('each advanced accounting capability has a visible canonical route',()=>{
  const paths=['/accounting/currency-fx','/accounting/cost-budget','/accounting/party-netting','/accounting/expenses-commissions','/accounting/assets-financing'];
  for(const path of paths){
    const route=findRoute(path);
    assert.equal(route.path,path);
    assert.notEqual(route.navigation,false);
  }
});
