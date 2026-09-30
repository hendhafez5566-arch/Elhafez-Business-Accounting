import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FollowupsPage, LeadsPage } from './crm-lead-followup-parity-pages.js';

test('lead management renders the canonical CRM pipeline instead of a single legacy list table',()=>{
 const html=renderToStaticMarkup(createElement(LeadsPage));
 assert.match(html,/CRM Lead Pipeline/);
 assert.match(html,/role="list" aria-label="مراحل مسار المبيعات"/);
 for(const stage of ['جديد','تم التواصل','مؤهل','تم عرض السعر','ناجح','مفقود'])assert.match(html,new RegExp(`aria-label="${stage}"`));
 assert.match(html,/Kanban/);
});

test('followups preserve the queue plus customer timeline workspace structure',()=>{
 const html=renderToStaticMarkup(createElement(FollowupsPage));
 assert.match(html,/قائمة المتابعات/);
 assert.match(html,/Timeline العميل المحتمل/);
 assert.match(html,/جدولة متابعة/);
 assert.match(html,/فلترة قائمة العمل/);
});
