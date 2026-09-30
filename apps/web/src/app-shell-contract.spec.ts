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
  assert.match(html, /class="ui-page-header"/);
  assert.match(html, /class="[^"]*\bui-page-stack\b[^"]*"/);
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
});

test('appearance settings are reachable from canonical navigation', () => {
  const html = renderToStaticMarkup(
    createElement(AppShell, { pathname: '/settings/appearance' }),
  );
  assert.match(html, /المظهر والتنقل/);
  assert.match(html, /استعادة الافتراضي/);
});
test('app-shell exposes data-screen-blueprint and data-screen-reference for observable route contract', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  assert.match(html, /data-screen-blueprint="dashboard"/);
  assert.match(html, /data-screen-reference="main-dashboard"/);
});

test('screen design attributes reflect the active route', () => {
  const testCases = [
    { pathname: '/crm/leads', blueprint: 'kanban', reference: 'crm-lead-pipeline' },
    { pathname: '/accounting', blueprint: 'dashboard', reference: 'financial-reporting' },
    { pathname: '/system-administration', blueprint: 'settings', reference: 'system-administration' },
    { pathname: '/hajj-umrah/rooming', blueprint: 'matrix', reference: 'rooming-allocation' },
  ];

  for (const { pathname, blueprint, reference } of testCases) {
    const html = renderToStaticMarkup(createElement(AppShell, { pathname }));
    assert.match(html, new RegExp(`data-screen-blueprint="${blueprint}"`), `Failed at ${pathname}`);
    assert.match(html, new RegExp(`data-screen-reference="${reference}"`), `Failed at ${pathname}`);
  }
});

test('ScreenLayoutBoundary renders canonical ui-page-stack with screen layout markers', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  assert.match(html, /class="ui-page-stack ui-screen-layout ui-screen-layout--dashboard"/);
});
