import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomersPage } from './crm-party-pages.js';

test('customers page renders the owner supplied atomic template surface instead of the legacy data-grid composition', () => {
  const html = renderToStaticMarkup(createElement(CustomersPage));
  assert.match(html, /سياحة برو/);
  assert.match(html, /العملاء والوكلاء/);
  assert.match(html, /ابحث، افتح الملف، وسجّل أي عملية بضغطتين/);
  assert.match(html, /عميل جديد/);
  assert.match(html, /ct-finder/);
  assert.match(html, /ct-sheet/);
  assert.doesNotMatch(html, /قاعدة بيانات العملاء/);
});
