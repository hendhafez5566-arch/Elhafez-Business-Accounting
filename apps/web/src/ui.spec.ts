import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Badge, Button, DataGrid, EmptyState, ErrorState, FormField, Input, LoadingState, Toast } from './ui.js';

test('shared components expose semantic controls and feedback roles', () => {
  const form = renderToStaticMarkup(createElement(FormField, { label: 'الاسم', required: true, error: 'مطلوب', children: createElement(Input, { required: true }) }));
  const feedback = renderToStaticMarkup(createElement('div', null,
    createElement(Button, { loading: true }, 'حفظ'), createElement(Badge, { tone: 'success', children: 'تم' }),
    createElement(Toast, { tone: 'error', children: 'خطأ' }), createElement(LoadingState), createElement(ErrorState), createElement(EmptyState),
    createElement(DataGrid, { columns: ['أ'] })));
  assert.match(form, /required=""/); assert.match(form, /role="alert"/);
  assert.match(feedback, /aria-busy="true"/); assert.match(feedback, /role="alert"/); assert.match(feedback, /<table>/);
});
