import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MasterDetailWorkspace,
  SCREEN_BLUEPRINTS,
  SCREEN_REFERENCE_IDS,
  ScreenLayoutBoundary,
  SettingsWorkspace,
  SplitWorkspace,
  WorkspacePane,
  isScreenDesign,
} from './screen-layouts.js';

test('canonical screen registry contains 15 reusable blueprint families and all 39 owner references', () => {
  assert.equal(Object.values(SCREEN_BLUEPRINTS).length, 15);
  assert.equal(Object.values(SCREEN_REFERENCE_IDS).length, 39);
  assert.equal(SCREEN_BLUEPRINTS.split, 'split');
  assert.equal(SCREEN_BLUEPRINTS.kanban, 'kanban');
  assert.equal(SCREEN_REFERENCE_IDS.bankReconciliation, 'bank-reconciliation');
  assert.equal(SCREEN_REFERENCE_IDS.mainDashboard, 'main-dashboard');
});

test('ScreenDesign validation accepts only registered blueprint/reference combinations', () => {
  assert.equal(isScreenDesign({ blueprint: 'dashboard', reference: 'main-dashboard' }), true);
  assert.equal(isScreenDesign({ blueprint: 'split', reference: 'bank-reconciliation' }), true);
  assert.equal(isScreenDesign({ blueprint: 'unknown', reference: 'main-dashboard' }), false);
  assert.equal(isScreenDesign({ blueprint: 'dashboard', reference: 'unknown' }), false);
  assert.equal(isScreenDesign(null), false);
});

test('ScreenLayoutBoundary replaces the page stack with one canonical structural boundary', () => {
  const markup = renderToStaticMarkup(
    createElement(ScreenLayoutBoundary, {
      design: { blueprint: 'dashboard', reference: 'main-dashboard' },
      children: createElement('span', null, 'content'),
    }),
  );
  assert.match(markup, /class="ui-page-stack ui-screen-layout ui-screen-layout--dashboard"/);
  assert.match(markup, /data-screen-blueprint="dashboard"/);
  assert.match(markup, /data-screen-reference="main-dashboard"/);
  assert.equal((markup.match(/ui-page-stack/g) ?? []).length, 1);
});

test('SplitWorkspace composes two canonical panes without owning business behavior', () => {
  const markup = renderToStaticMarkup(createElement(SplitWorkspace, { left: 'ledger', right: 'bank' }));
  assert.match(markup, /ui-workspace-split/);
  assert.match(markup, /ui-workspace-pane--primary/);
  assert.match(markup, /ui-workspace-pane--secondary/);
  assert.match(markup, />ledger</);
  assert.match(markup, />bank</);
});

test('MasterDetailWorkspace supports an optional detail pane', () => {
  const withDetail = renderToStaticMarkup(createElement(MasterDetailWorkspace, { master: 'list', detail: 'detail' }));
  const withoutDetail = renderToStaticMarkup(createElement(MasterDetailWorkspace, { master: 'list' }));
  assert.match(withDetail, /ui-workspace-pane--master/);
  assert.match(withDetail, /ui-workspace-pane--detail/);
  assert.match(withoutDetail, /ui-workspace-pane--master/);
  assert.doesNotMatch(withoutDetail, /ui-workspace-pane--detail/);
});

test('SettingsWorkspace uses canonical navigation and content panes', () => {
  const markup = renderToStaticMarkup(createElement(SettingsWorkspace, { navigation: 'nav', content: 'settings' }));
  assert.match(markup, /ui-workspace-settings/);
  assert.match(markup, /ui-workspace-pane--nav/);
  assert.match(markup, /ui-workspace-pane--content/);
});

test('WorkspacePane adds only canonical structural classes', () => {
  const markup = renderToStaticMarkup(createElement(WorkspacePane, { variant: 'detail', className: 'extra', children: 'body' }));
  assert.match(markup, /ui-card ui-workspace-pane ui-workspace-pane--detail extra/);
});
