import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProcurementOperationsPage } from './procurement-pages.js';
import { ProcurementSourcingPage } from './procurement-sourcing-page.js';

test('purchase operations render a canonical workspace instead of the legacy two-tab shell',()=>{
 const html=renderToStaticMarkup(createElement(ProcurementOperationsPage));
 assert.match(html,/ui-workspace-settings/);
 assert.match(html,/aria-label="مساحات تشغيل المشتريات"/);
 assert.match(html,/Purchase Orders/);
 assert.match(html,/أوامر الشراء/);
 assert.match(html,/الشراء المباشر/);
 assert.doesNotMatch(html,/role="tablist"/);
 assert.doesNotMatch(html,/class="ui-tabs"/);
});

test('sourcing renders one canonical staged workspace and no nested page-stack layer',()=>{
 const html=renderToStaticMarkup(createElement(ProcurementSourcingPage));
 assert.match(html,/ui-workspace-settings/);
 assert.match(html,/aria-label="مراحل دورة التوريد"/);
 assert.match(html,/1\. طلبات الشراء/);
 assert.match(html,/2\. RFQ والمقارنة/);
 assert.match(html,/3\. الترسيات/);
 assert.doesNotMatch(html,/ui-page-stack/);
 assert.doesNotMatch(html,/role="tablist"/);
});
