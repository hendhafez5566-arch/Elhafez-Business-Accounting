import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from './app-shell.js';

test('global shell contract preserves RTL, sidebar, topbar, navigation and main landmarks', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  assert.match(html, /class="app-shell[^"]*" dir="rtl"/);
  assert.match(html, /class="app-sidebar"/);
  assert.match(html, /class="app-topbar"/);
  assert.match(html, /aria-label="التنقل الرئيسي"/);
  assert.match(html, /class="app-main"/);
  assert.match(html, /aria-current="page"/);
});

test('local content renders inside the canonical shell without replacing shell structure', () => {
  const html = renderToStaticMarkup(
    createElement(AppShell, {
      pathname: '/',
      children: createElement('section', { 'data-testid': 'local-content' }, 'محتوى محلي'),
    }),
  );
  assert.match(html, /data-testid="local-content"/);
  assert.match(html, /class="app-sidebar"/);
  assert.match(html, /class="app-topbar"/);
});
