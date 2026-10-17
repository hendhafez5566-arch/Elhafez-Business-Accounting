import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Badge, Button, DataGrid, Dialog, EmptyState, ErrorState, FormField, Input, LoadingState, Toast } from './ui.js';

test('shared components expose semantic controls and feedback roles', () => {
  const form = renderToStaticMarkup(createElement(FormField, { label: 'الاسم', required: true, error: 'مطلوب', children: createElement(Input, { required: true }) }));
  const feedback = renderToStaticMarkup(createElement('div', null,
    createElement(Button, { loading: true }, 'حفظ'), createElement(Badge, { tone: 'success', children: 'تم' }),
    createElement(Toast, { tone: 'error', children: 'خطأ' }), createElement(LoadingState), createElement(ErrorState), createElement(EmptyState),
    createElement(DataGrid, { columns: ['أ'] })));
  assert.match(form, /required=""/); assert.match(form, /role="alert"/);
  assert.match(feedback, /aria-busy="true"/); assert.match(feedback, /role="alert"/); assert.match(feedback, /<table>/);
});


test('coexisting dialogs each reference their own accessible title',()=>{
 const titles=['تغيير المندوب','تأكيد الحجز','إلغاء الحجز'],html=renderToStaticMarkup(createElement('section',null,...titles.map(title=>createElement(Dialog,{key:title,open:false,title,onClose:()=>{},children:'محتوى'})))),ids=[...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(match=>match[1]!);
 assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);for(const [index,id] of ids.entries())assert.ok(html.includes('<h2 id="'+id+'">'+titles[index]+'</h2>'));
});
