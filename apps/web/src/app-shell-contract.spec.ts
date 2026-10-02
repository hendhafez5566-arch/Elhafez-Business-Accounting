import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from './app-shell.js';
import { foundationRoutes } from './routes.js';

const workspacePath = '/system-administration';

test('portal root keeps only the structural topbar and a blank white rebuild surface', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  assert.match(html, /class="app-shell app-shell--portal" dir="rtl"/);
  assert.match(html, /class="app-topbar"/);
  assert.match(html, /data-route-id="foundation"/);
  assert.match(html, /data-route-surface="standard"/);
  assert.match(html, /data-ui-reset="blank"/);
  assert.doesNotMatch(html, /class="app-sidebar"/);
  assert.doesNotMatch(html, /class="ui-page-header"/);
  assert.doesNotMatch(html, /class="portal-home"/);
  assert.doesNotMatch(html, /class="portal-workspace-card"/);
});

test('every registered internal route mounts the blank reset surface instead of its former page element', () => {
  for (const route of foundationRoutes) {
    const html = renderToStaticMarkup(createElement(AppShell, { pathname: route.path }));
    assert.match(html, new RegExp(`data-route-id="${route.id}"`));
    assert.match(html, /data-ui-reset="blank"/);
    assert.doesNotMatch(html, /class="ui-page-header"/);
    assert.doesNotMatch(html, /ui-page-stack/);
  }
});

test('standard workspace shell preserves navigation structure while route content stays blank', () => {
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
  assert.match(html, /data-ui-reset="blank"/);
  assert.doesNotMatch(html, /class="ui-page-header"/);
  assert.match(html, /شركة الحافظ/);
  assert.match(html, /المستخدم الحالي/);
  assert.match(html, /الفرع الرئيسي/);
});

test('workspace shell keeps global search, shortcuts, notifications and user menu', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: workspacePath }));
  assert.match(html, /aria-label="البحث في أقسام النظام"/);
  assert.match(html, /aria-label="اختصارات مساحات العمل"/);
  assert.match(html, /aria-label="الإشعارات"/);
  assert.match(html, /aria-label="قائمة المستخدم"/);
  assert.match(html, /href="\/notifications"/);
  assert.match(html, /href="\/settings\/account"/);
  assert.match(html, /href="\/settings\/appearance"/);
});

test('sidebar still supports fixed, compact and auto preference modes', () => {
  for (const sidebarMode of ['fixed', 'compact', 'auto'] as const) {
    const html = renderToStaticMarkup(
      createElement(AppShell, {
        pathname: workspacePath,
        initialPreferences: { sidebarMode },
      }),
    );
    assert.match(html, new RegExp('data-sidebar-mode="' + sidebarMode + '"'));
    assert.equal((html.match(/class="app-sidebar"/g) ?? []).length, 1);
    assert.match(html, /data-ui-reset="blank"/);
  }
});

test('caller-provided route children cannot remount old or parallel internal presentation', () => {
  const html = renderToStaticMarkup(
    createElement(AppShell, {
      pathname: workspacePath,
      children: createElement('section', { 'data-testid': 'local-content' }, 'محتوى محلي'),
    }),
  );
  assert.doesNotMatch(html, /data-testid="local-content"/);
  assert.doesNotMatch(html, /محتوى محلي/);
  assert.match(html, /data-ui-reset="blank"/);
  assert.equal((html.match(/class="app-sidebar"/g) ?? []).length, 1);
  assert.equal((html.match(/class="app-topbar"/g) ?? []).length, 1);
});

test('full-bleed customer route is genuinely blank rather than hidden under an overlay', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/crm/customers' }));
  assert.match(html, /data-route-id="crm-customers"/);
  assert.match(html, /data-route-surface="full-bleed"/);
  assert.match(html, /data-ui-reset="blank"/);
  assert.doesNotMatch(html, /class="ct-root"/);
  assert.doesNotMatch(html, /class="app-sidebar"/);
  assert.doesNotMatch(html, /class="app-topbar"/);
  assert.doesNotMatch(html, /class="ui-page-header"/);
  assert.doesNotMatch(html, /ui-page-stack/);
});

test('route identity and structural design metadata remain available for the later rebuild', () => {
  const rootHtml = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  assert.match(rootHtml, /data-screen-blueprint="dashboard"/);
  assert.match(rootHtml, /data-screen-reference="main-dashboard"/);
  assert.match(rootHtml, /data-ui-reset="blank"/);
  assert.doesNotMatch(rootHtml, /ui-screen-layout--dashboard/);

  const crmHtml = renderToStaticMarkup(createElement(AppShell, { pathname: '/crm/leads' }));
  assert.match(crmHtml, /data-route-id="crm-leads"/);
  assert.match(crmHtml, /data-screen-blueprint="kanban"/);
  assert.match(crmHtml, /data-screen-reference="crm-lead-pipeline"/);
  assert.match(crmHtml, /data-ui-reset="blank"/);
  assert.doesNotMatch(crmHtml, /ui-screen-layout--kanban/);
});
