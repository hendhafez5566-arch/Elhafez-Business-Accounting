import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from './app-shell.js';
import { foundationRoutes } from './routes.js';

const workspaceLabels = ['الحج والعمرة', 'المبيعات والعملاء', 'الخدمات السياحية', 'المشتريات والموردون', 'المحاسبة والمالية', 'التقارير والرقابة', 'الإدارة والإعدادات'];

test('portal root renders exactly the seven new workspaces', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/' }));
  assert.match(html, /class="app-shell app-shell--portal"/);
  assert.match(html, /class="portal-home"/);
  assert.equal((html.match(/class="portal-workspace-card"/g) ?? []).length, 7);
  for (const label of workspaceLabels) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /data-ui-reset="blank"/);
  assert.doesNotMatch(html, /class="app-sidebar"/);
});

test('every workspace route keeps one shell and a blank rebuild surface', () => {
  for (const route of foundationRoutes.slice(1)) {
    const html = renderToStaticMarkup(createElement(AppShell, { pathname: route.path }));
    assert.match(html, new RegExp(`data-route-id="${route.id}"`));
    assert.equal((html.match(/class="app-sidebar"/g) ?? []).length, 1);
    assert.equal((html.match(/class="app-topbar"/g) ?? []).length, 1);
    assert.match(html, /data-ui-reset="blank"/);
    assert.doesNotMatch(html, /class="portal-home"/);
  }
});

test('clean shell exposes no links to removed legacy utility pages', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/accounting' }));
  assert.doesNotMatch(html, /href="\/notifications"/);
  assert.doesNotMatch(html, /href="\/settings\/account"/);
  assert.doesNotMatch(html, /href="\/settings\/appearance"/);
});

test('caller content cannot create a parallel route owner', () => {
  const html = renderToStaticMarkup(createElement(AppShell, {
    pathname: '/accounting',
    children: createElement('section', { 'data-testid': 'legacy-content' }, 'قديم'),
  }));
  assert.doesNotMatch(html, /data-testid="legacy-content"/);
  assert.doesNotMatch(html, />قديم</);
  assert.match(html, /data-ui-reset="blank"/);
});
