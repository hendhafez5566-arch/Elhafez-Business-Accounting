import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ScreenLayoutBoundary,
  SplitWorkspace,
  MasterDetailWorkspace,
  SettingsWorkspace,
  WorkspacePane,
  isScreenDesign,
  SCREEN_BLUEPRINTS,
  SCREEN_REFERENCE_IDS,
} from './screen-layouts.js';

test('isScreenDesign returns true for valid ScreenDesign', () => {
  assert.ok(isScreenDesign({ blueprint: 'dashboard', reference: 'main-dashboard' }));
  assert.ok(isScreenDesign({ blueprint: 'kanban', reference: 'crm-lead-pipeline' }));
  assert.ok(isScreenDesign({ blueprint: 'matrix', reference: 'rooming-allocation' }));
});

test('isScreenDesign returns false for invalid blueprint', () => {
  assert.ok(!isScreenDesign({ blueprint: 'invalid', reference: 'main-dashboard' }));
});

test('isScreenDesign returns false for invalid reference', () => {
  assert.ok(!isScreenDesign({ blueprint: 'dashboard', reference: 'invalid-ref' }));
});

test('isScreenDesign returns false for missing fields', () => {
  assert.ok(!isScreenDesign({ blueprint: 'dashboard' }));
  assert.ok(!isScreenDesign({ reference: 'main-dashboard' }));
  assert.ok(!isScreenDesign({}));
});

test('isScreenDesign returns false for non-objects', () => {
  assert.ok(!isScreenDesign(null));
  assert.ok(!isScreenDesign(undefined));
  assert.ok(!isScreenDesign('string'));
  assert.ok(!isScreenDesign(123));
});

test('ScreenLayoutBoundary renders ui-page-stack, ui-screen-layout, and blueprint class', () => {
  const html = renderToStaticMarkup(
    ScreenLayoutBoundary({ design: { blueprint: 'dashboard', reference: 'main-dashboard' }, children: 'Content' })
  );

  assert.match(html, /ui-page-stack/);
  assert.match(html, /ui-screen-layout/);
  assert.match(html, /ui-screen-layout--dashboard/);
});

test('ScreenLayoutBoundary renders data-screen-blueprint attribute', () => {
  const html = renderToStaticMarkup(
    ScreenLayoutBoundary({ design: { blueprint: 'kanban', reference: 'crm-lead-pipeline' }, children: 'Content' })
  );

  assert.match(html, /data-screen-blueprint="kanban"/);
});

test('ScreenLayoutBoundary renders data-screen-reference attribute', () => {
  const html = renderToStaticMarkup(
    ScreenLayoutBoundary({ design: { blueprint: 'kanban', reference: 'crm-lead-pipeline' }, children: 'Content' })
  );

  assert.match(html, /data-screen-reference="crm-lead-pipeline"/);
});

test('SplitWorkspace renders two panes with split layout class', () => {
  const html = renderToStaticMarkup(
    SplitWorkspace({ left: 'Left', right: 'Right' })
  );

  assert.match(html, /ui-workspace-split/);
  assert.match(html, /ui-workspace-pane/);
  assert.match(html, /ui-workspace-pane--primary/);
  assert.match(html, /ui-workspace-pane--secondary/);
  assert.match(html, />Left</);
  assert.match(html, />Right</);
});

test('SplitWorkspace accepts optional className', () => {
  const html = renderToStaticMarkup(
    SplitWorkspace({ left: 'L', right: 'R', className: 'custom' })
  );

  assert.match(html, /ui-workspace-split custom/);
});

test('MasterDetailWorkspace renders master pane always, detail pane when provided', () => {
  const html = renderToStaticMarkup(
    MasterDetailWorkspace({ master: 'Master', detail: 'Detail' })
  );

  assert.match(html, /ui-workspace-master-detail/);
  assert.match(html, /ui-workspace-pane--master/);
  assert.match(html, /ui-workspace-pane--detail/);
  assert.match(html, />Master</);
  assert.match(html, />Detail</);
});

test('MasterDetailWorkspace omits detail pane when undefined', () => {
  const html = renderToStaticMarkup(
    MasterDetailWorkspace({ master: 'Master' })
  );

  assert.match(html, /ui-workspace-pane--master/);
  assert.ok(!html.includes('ui-workspace-pane--detail'));
});

test('SettingsWorkspace renders navigation and content panes with settings layout class', () => {
  const html = renderToStaticMarkup(
    SettingsWorkspace({ navigation: 'Nav', content: 'Content' })
  );

  assert.match(html, /ui-workspace-settings/);
  assert.match(html, /ui-workspace-pane--nav/);
  assert.match(html, /ui-workspace-pane--content/);
  assert.match(html, />Nav</);
  assert.match(html, />Content</);
});

test('SettingsWorkspace accepts optional className', () => {
  const html = renderToStaticMarkup(
    SettingsWorkspace({ navigation: 'N', content: 'C', className: 'custom' })
  );

  assert.match(html, /ui-workspace-settings custom/);
});

test('WorkspacePane renders with default classes', () => {
  const html = renderToStaticMarkup(
    WorkspacePane({ children: 'Content' })
  );

  assert.match(html, /ui-workspace-pane/);
});

test('WorkspacePane renders with variant class', () => {
  const html = renderToStaticMarkup(
    WorkspacePane({ variant: 'primary', children: 'Content' })
  );

  assert.match(html, /ui-workspace-pane--primary/);
});

test('WorkspacePane accepts optional className', () => {
  const html = renderToStaticMarkup(
    WorkspacePane({ variant: 'secondary', className: 'custom', children: 'Content' })
  );

  assert.match(html, /ui-workspace-pane--secondary custom/);
});

test('SCREEN_BLUEPRINTS includes all 15 families', () => {
  const blueprints = Object.values(SCREEN_BLUEPRINTS);
  assert.equal(blueprints.length, 15);
  assert.ok(blueprints.includes('dashboard'));
  assert.ok(blueprints.includes('kanban'));
  assert.ok(blueprints.includes('matrix'));
  assert.ok(blueprints.includes('settings'));
});

test('SCREEN_REFERENCE_IDS includes all 39 references', () => {
  const references = Object.values(SCREEN_REFERENCE_IDS);
  assert.equal(references.length, 39);
  assert.ok(references.includes('main-dashboard'));
  assert.ok(references.includes('crm-lead-pipeline'));
  assert.ok(references.includes('rooming-allocation'));
  assert.ok(references.includes('fleet-transport'));
});

