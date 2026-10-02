import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from './app-shell.js';

const workspacePath = '/system-administration';

test('portal home is the single root UI and intentionally renders without a sidebar or page header', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  assert.match(html, /class="app-shell app-shell--portal" dir="rtl"/);
  assert.match(html, /class="app-topbar"/);
  assert.match(html, /class="portal-home"/);
  assert.match(html, /data-route-id="foundation"/);
  assert.match(html, /data-route-surface="standard"/);
  assert.match(html, /الصفحة الرئيسية/);
  assert.match(html, /اختر مساحة العمل المطلوبة/);
  assert.match(html, /aria-label="البحث في أقسام النظام"/);
  assert.match(html, /placeholder="ابحث عن شاشة أو قسم\.\.\."/);
  assert.doesNotMatch(html, /class="app-sidebar"/);
  assert.doesNotMatch(html, /class="ui-page-header"/);
});

test('portal home exposes the seven legacy workspaces in canonical order', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  const labels = [
    'الحج والعمرة',
    'المبيعات والعملاء CRM',
    'الخدمات السياحية',
    'المشتريات والموردون',
    'المحاسبة والمالية',
    'التقارير والرقابة',
    'الإدارة والإعدادات',
  ];
  let cursor = -1;
  for (const label of labels) {
    const index = html.indexOf(label, cursor + 1);
    assert.ok(index > cursor, `${label} must appear once the previous workspace has rendered`);
    cursor = index;
  }
  assert.equal((html.match(/class="portal-workspace-card"/g) ?? []).length, 7);
});

test('workspace shell preserves one RTL sidebar, one topbar and contextual navigation', () => {
  const html = renderToStaticMarkup(
    createElement(AppShell, {
      pathname: workspacePath,
      companyLabel: 'شركة الحافظ',
      branchLabel: 'الفرع الرئيسي',
      userLabel: 'المستخدم الحالي',
      subscriptionStatus: 'active',
    }),
  );
  assert.match(html, /class="app-shell" dir="rtl"/);
  assert.equal((html.match(/class="app-sidebar"/g) ?? []).length, 1);
  assert.equal((html.match(/class="app-topbar"/g) ?? []).length, 1);
  assert.match(html, /aria-label="التنقل الرئيسي"/);
  assert.match(html, /class="ui-page-header"/);
  assert.match(html, /شركة الحافظ/);
  assert.match(html, /الإدارة والإعدادات/);
  assert.match(html, /واجهة القسم/);
  assert.match(html, /مساحات العمل/);
  assert.match(html, /المستخدم الحالي/);
  assert.match(html, /الفرع الرئيسي/);
});

test('workspace shell exposes global search, workspace shortcuts, notifications and user menu', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: workspacePath }));
  assert.match(html, /aria-label="البحث في أقسام النظام"/);
  assert.match(html, /aria-label="اختصارات مساحات العمل"/);
  assert.match(html, /aria-label="الإشعارات"/);
  assert.match(html, /aria-label="قائمة المستخدم"/);
  assert.match(html, /href="\/notifications"/);
  assert.match(html, /href="\/settings\/account"/);
  assert.match(html, /href="\/settings\/appearance"/);
});

test('sidebar supports fixed, compact and auto preference modes through one canonical workspace shell', () => {
  for (const sidebarMode of ['fixed', 'compact', 'auto'] as const) {
    const html = renderToStaticMarkup(
      createElement(AppShell, {
        pathname: workspacePath,
        initialPreferences: { sidebarMode },
      }),
    );
    assert.match(html, new RegExp('data-sidebar-mode="' + sidebarMode + '"'));
    assert.equal((html.match(/class="app-sidebar"/g) ?? []).length, 1);
  }
});

test('local content renders inside the canonical workspace shell without replacing shell structure', () => {
  const html = renderToStaticMarkup(
    createElement(AppShell, {
      pathname: workspacePath,
      children: createElement('section', { 'data-testid': 'local-content' }, 'محتوى محلي'),
    }),
  );
  assert.match(html, /data-testid="local-content"/);
  assert.equal((html.match(/class="app-sidebar"/g) ?? []).length, 1);
  assert.equal((html.match(/class="app-topbar"/g) ?? []).length, 1);
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

test('appearance settings remain reachable from canonical navigation', () => {
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

test('screen design changes with a standard route while the canonical shell remains single', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/crm/leads' }));
  assert.match(html, /data-screen-blueprint="kanban"/);
  assert.match(html, /data-screen-reference="crm-lead-pipeline"/);
  assert.match(html, /ui-screen-layout--kanban/);
  assert.equal((html.match(/class="app-shell"/g) ?? []).length, 1);
  assert.equal((html.match(/ui-page-stack/g) ?? []).length, 1);
});
