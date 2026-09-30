import assert from 'node:assert/strict';
import test from 'node:test';
import { defineRoutes, findRoute, foundationRoutes } from './routes.js';
import { isScreenDesign } from './ui/screen-layouts.js';

const moduleDesign = { blueprint: 'module', reference: 'master-module-template' } as const;

test('routing has a shell-only Arabic-first fallback route', () => {
  assert.equal(foundationRoutes[0]?.label, 'الرئيسية');
  assert.equal(findRoute('/missing').id, 'foundation');
});

test('future route registration is separated from shell presentation but requires a structural design', () => {
  const routes = defineRoutes({ id: 'extension', path: '/extension', label: 'امتداد', design: moduleDesign, element: null });
  assert.equal(findRoute('/extension', routes).id, 'extension');
});

test('appearance and navigation preferences have one canonical settings route', () => {
  const route = findRoute('/settings/appearance');
  assert.equal(route.id, 'appearance-settings');
  assert.equal(route.group, 'الإعدادات');
  assert.equal(route.icon, 'appearance');
  assert.equal(route.design.blueprint, 'settings');
});

test('duplicate route ids and paths are rejected before they can corrupt navigation', () => {
  assert.throws(() =>
    defineRoutes(
      { id: 'one', path: '/one', label: 'واحد', design: moduleDesign, element: null },
      { id: 'one', path: '/two', label: 'اثنان', design: moduleDesign, element: null },
    ),
  );
  assert.throws(() =>
    defineRoutes(
      { id: 'one', path: '/same', label: 'واحد', design: moduleDesign, element: null },
      { id: 'two', path: '/same', label: 'اثنان', design: moduleDesign, element: null },
    ),
  );
});

test('account credentials have one canonical self-service route',()=>{
  const route=findRoute('/settings/account');
  assert.equal(route.id,'account-settings');
  assert.equal(route.group,'الإعدادات');
  assert.equal(route.icon,'profile');
  assert.equal(route.design.blueprint,'settings');
});

test('detail and account routes remain reachable without cluttering the main navigation',()=>{
  for(const path of ['/crm/customer-360','/crm/agent-360','/hajj-umrah/program-workspace','/settings/appearance','/settings/account']){
    const route=findRoute(path);
    assert.equal(route.path,path);
    assert.equal(route.navigation,false);
  }
});

test('every registered route declares a valid canonical ScreenDesign', () => {
  for (const route of foundationRoutes) assert.equal(isScreenDesign(route.design), true, route.id);
});

test('structurally distinct routes map to distinct canonical blueprints', () => {
  assert.deepEqual(findRoute('/').design, { blueprint: 'dashboard', reference: 'main-dashboard' });
  assert.deepEqual(findRoute('/crm/leads').design, { blueprint: 'kanban', reference: 'crm-lead-pipeline' });
  assert.deepEqual(findRoute('/hajj-umrah/rooming').design, { blueprint: 'matrix', reference: 'rooming-allocation' });
  assert.deepEqual(findRoute('/system-administration').design, { blueprint: 'settings', reference: 'system-administration' });
  assert.deepEqual(findRoute('/accounting').design, { blueprint: 'dashboard', reference: 'financial-reporting-center' });
});
