import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UmrahBarcodePage } from './hajj-umrah-barcode-page.js';
import { foundationRoutes } from './routes.js';

test('Umrah barcode is registered as a dedicated Hajj & Umrah route',()=>{
 const route=foundationRoutes.find(value=>value.id==='hajj-umrah-barcode');
 assert.ok(route);
 assert.equal(route.path,'/hajj-umrah/barcode');
 assert.equal(route.label,'باركود العمرة');
 assert.equal(route.group,'الحج والعمرة');
});

test('Umrah barcode shell is Arabic-first and explicitly marked as coming soon',()=>{
 const html=renderToStaticMarkup(createElement(UmrahBarcodePage));
 assert.match(html,/باركود العمرة/);
 assert.match(html,/قريبًا/);
 assert.match(html,/باركود العمرة المصري/);
});
