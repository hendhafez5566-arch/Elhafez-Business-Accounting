import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from './app-shell.js';

test('global shell contract preserves RTL, right sidebar, topbar, navigation and main landmarks', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  assert.match(html, /class="app-shell" dir="rtl"/);
  assert.match(html, /class="app-sidebar"/);
  assert.match(html, /class="app-topbar"/);
  assert.match(html, /aria-label="التنقل الرئيسي"/);
  assert.match(html, /class="app-main"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /data-sidebar-mode="fixed"/);
  assert.match(html, /class="ui-page-header"/);
  assert.match(html, /class="ui-page-stack"/);
});

test('sidebar supports fixed, compact and auto preference modes through one canonical shell', () => {
  for (const sidebarMode of ['fixed', 'compact', 'auto'] as const) {
    const html = renderToStaticMarkup(
      createElement(AppShell, {
        pathname: '/',
        initialPreferences: { sidebarMode },
      }),
    );
    assert.match(html, new RegExp('data-sidebar-mode="' + sidebarMode + '"'));
  }
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

test('appearance settings are reachable from canonical navigation', () => {
  const html = renderToStaticMarkup(
    createElement(AppShell, { pathname: '/settings/appearance' }),
  );
  assert.match(html, /المظهر والتنقل/);
  assert.match(html, /استعادة الافتراضي/);
});
