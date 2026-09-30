import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReactElement } from 'react';
import { foundationRoutes } from './routes.js';
import { SystemAdministrationPage } from './system-administration-page.js';
import { SystemAdministrationWorkspacePage } from './system-administration-structural-page.js';

const route = (id: string) => {
  const value = foundationRoutes.find(item => item.id === id);
  assert.ok(value, `missing route ${id}`);
  return value;
};

test('primary system administration route owns a canonical settings workspace', () => {
  const primary = route('system-administration');
  assert.equal((primary.element as ReactElement).type, SystemAdministrationWorkspacePage);
  assert.equal(primary.design.blueprint, 'settings');
  assert.equal(primary.design.reference, 'system-administration');
  assert.notEqual((primary.element as ReactElement).type, SystemAdministrationPage);
});

test('legacy transaction owner remains single and hidden from primary navigation', () => {
  const manage = route('system-administration-manage');
  assert.equal(manage.navigation, false);
  assert.equal(manage.path, '/system-administration/manage');
  assert.equal((manage.element as ReactElement).type, SystemAdministrationPage);
});

test('specialized system foundations remain independent canonical routes', () => {
  assert.equal(route('system-custom-fields').path, '/system-administration/custom-fields');
  assert.equal(route('system-document-numbering').path, '/system-administration/document-numbering');
  assert.equal(route('system-automation').path, '/system-administration/automation');
  assert.equal(route('system-custom-fields').design.blueprint, 'settings');
  assert.equal(route('system-automation').design.blueprint, 'command-center');
});
