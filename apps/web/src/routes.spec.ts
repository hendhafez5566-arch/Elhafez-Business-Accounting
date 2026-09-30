import assert from 'node:assert/strict';
import test from 'node:test';
import { defineRoutes, findRoute, foundationRoutes } from './routes.js';

test('routing has a shell-only Arabic-first fallback route', () => {
  assert.equal(foundationRoutes[0]?.label, 'الرئيسية');
  assert.equal(findRoute('/missing').id, 'foundation');
});

test('future route registration is separated from shell presentation', () => {
  const routes = defineRoutes({ id: 'extension', path: '/extension', label: 'امتداد', design: { blueprint: 'module', reference: 'atoms' }, element: null });
  assert.equal(findRoute('/extension', routes).id, 'extension');
});

test('appearance and navigation preferences have one canonical settings route', () => {
  const route = findRoute('/settings/appearance');
  assert.equal(route.id, 'appearance-settings');
  assert.equal(route.group, 'الإعدادات');
  assert.equal(route.icon, 'appearance');
});

test('duplicate route ids and paths are rejected before they can corrupt navigation', () => {
  assert.throws(() =>
    defineRoutes(
      { id: 'one', path: '/one', label: 'واحد', design: { blueprint: 'module', reference: 'atoms' }, element: null },
      { id: 'one', path: '/two', label: 'اثنان', design: { blueprint: 'module', reference: 'atoms' }, element: null },
    ),
  );
  assert.throws(() =>
    defineRoutes(
      { id: 'one', path: '/same', label: 'واحد', design: { blueprint: 'module', reference: 'atoms' }, element: null },
      { id: "two", path: "/same", label: "اثنان", design: { blueprint: "module", reference: "atoms" }, element: null },
    ),
  );
});


test('account credentials have one canonical self-service route',()=>{const route=findRoute('/settings/account');assert.equal(route.id,'account-settings');assert.equal(route.group,'الإعدادات');assert.equal(route.icon,'profile');});


test('detail and account routes remain reachable without cluttering the main navigation',()=>{
 for(const path of ['/crm/customer-360','/crm/agent-360','/hajj-umrah/program-workspace','/settings/appearance','/settings/account']){
  const route=findRoute(path);
  assert.equal(route.path,path);
  assert.equal(route.navigation,false);
 }
});

test('all foundation routes have valid explicit ScreenDesign', () => {
  for (const route of foundationRoutes) {
    assert.ok(route.design, `Route "${route.id}" (${route.path}) missing design`);
    assert.ok(
      typeof route.design.blueprint === 'string' && route.design.blueprint.length > 0,
      `Route "${route.id}" has invalid blueprint`
    );
    assert.ok(
      typeof route.design.reference === 'string' && route.design.reference.length > 0,
      `Route "${route.id}" has invalid reference`
    );
  }
});

test('root route / has dashboard blueprint and main-dashboard reference', () => {
  const route = findRoute('/');
  assert.equal(route.design.blueprint, 'dashboard');
  assert.equal(route.design.reference, 'main-dashboard');
});

test('crm leads route has kanban blueprint and crm-lead-pipeline reference', () => {
  const route = findRoute('/crm/leads');
  assert.equal(route.design.blueprint, 'kanban');
  assert.equal(route.design.reference, 'crm-lead-pipeline');
});

test('accounting workspace has dashboard blueprint and financial-reporting reference', () => {
  const route = findRoute('/accounting');
  assert.equal(route.design.blueprint, 'dashboard');
  assert.equal(route.design.reference, 'financial-reporting');
});

test('system-administration has settings blueprint and system-administration reference', () => {
  const route = findRoute('/system-administration');
  assert.equal(route.design.blueprint, 'settings');
  assert.equal(route.design.reference, 'system-administration');
});

test('hajj-umrah rooming has matrix blueprint and rooming-allocation reference', () => {
  const route = findRoute('/hajj-umrah/rooming');
  assert.equal(route.design.blueprint, 'matrix');
  assert.equal(route.design.reference, 'rooming-allocation');
});
