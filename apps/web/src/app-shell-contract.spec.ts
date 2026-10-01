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
  assert.match(html, /data-route-id="foundation"/);
  assert.match(html, /data-route-surface="standard"/);
  assert.match(html, /class="ui-page-header"/);
  assert.match(html, /class="[^"]*ui-page-stack[^"]*"/);
});

test('Gemini app layout exposes global route search and ERP brand through the canonical shell', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  assert.match(html, /الحافظ ERP/);
  assert.match(html, /aria-label="البحث في أقسام النظام"/);
  assert.match(html, /placeholder="ابحث عن شاشة أو قسم\.\.\."/);
  assert.match(html, /الرئيسية/);
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
  assert.equal((html.match(/ui-page-stack/g) ?? []).length, 1);
});

test('full-bleed route replaces the standard shell instead of rendering it and hiding it', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/crm/customers' }));
  assert.match(html, /data-route-id="crm-customers"/);
  assert.match(html, /data-route-surface="full-bleed"/);
  assert.match(html, /class="ct-root"/);
  assert.doesNotMatch(html, /class="app-sidebar"/);
  assert.doesNotMatch(html, /class="app-topbar"/);
  assert.doesNotMatch(html, /class="ui-page-header"/);
  assert.doesNotMatch(html, /ui-page-stack/);
});

test('appearance settings are reachable from canonical navigation', () => {
  const html = renderToStaticMarkup(
    createElement(AppShell, { pathname: '/settings/appearance' }),
  );
  assert.match(html, /المظهر والتنقل/);
  assert.match(html, /استعادة الافتراضي/);
});

test('shell exposes the active structural blueprint and reference as an observable contract', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  assert.match(html, /data-screen-blueprint="dashboard"/);
  assert.match(html, /data-screen-reference="main-dashboard"/);
  assert.match(html, /ui-screen-layout--dashboard/);
});

test('screen design changes with the route while the canonical shell remains single', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/crm/leads' }));
  assert.match(html, /data-screen-blueprint="kanban"/);
  assert.match(html, /data-screen-reference="crm-lead-pipeline"/);
  assert.match(html, /ui-screen-layout--kanban/);
  assert.equal((html.match(/class="app-shell"/g) ?? []).length, 1);
  assert.equal((html.match(/ui-page-stack/g) ?? []).length, 1);
});
