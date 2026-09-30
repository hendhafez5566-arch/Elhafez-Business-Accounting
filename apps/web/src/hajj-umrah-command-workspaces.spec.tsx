import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReactElement } from 'react';
import { foundationRoutes } from './routes.js';
import { ProgramWorkspacePage } from './hajj-umrah-pages.js';
import { HajjUmrahReadinessPage } from './hajj-umrah-readiness-page.js';
import { HajjUmrahProgramCommandPage, HajjUmrahReadinessCommandPage } from './hajj-umrah-command-workspaces.js';

const route = (id: string) => {
  const value = foundationRoutes.find(item => item.id === id);
  assert.ok(value, `missing route ${id}`);
  return value;
};
const elementType = (id: string) => (route(id).element as ReactElement).type;

test('program workspace route renders the structural command center instead of legacy tabs', () => {
  assert.equal(elementType('hajj-umrah-program-workspace'), HajjUmrahProgramCommandPage);
  assert.notEqual(elementType('hajj-umrah-program-workspace'), ProgramWorkspacePage);
  assert.equal(route('hajj-umrah-program-workspace').design.blueprint, 'command-center');
});

test('readiness route renders the structural command center instead of legacy tabs', () => {
  assert.equal(elementType('hajj-umrah-readiness'), HajjUmrahReadinessCommandPage);
  assert.notEqual(elementType('hajj-umrah-readiness'), HajjUmrahReadinessPage);
  assert.equal(route('hajj-umrah-readiness').design.blueprint, 'command-center');
});

test('legacy write owners remain single hidden manage routes', () => {
  const programOwner = route('hajj-umrah-program-workspace-manage');
  const readinessOwner = route('hajj-umrah-readiness-manage');
  assert.equal(programOwner.navigation, false);
  assert.equal(readinessOwner.navigation, false);
  assert.equal((programOwner.element as ReactElement).type, ProgramWorkspacePage);
  assert.equal((readinessOwner.element as ReactElement).type, HajjUmrahReadinessPage);
});
