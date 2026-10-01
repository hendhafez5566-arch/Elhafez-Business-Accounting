import assert from 'node:assert/strict';
import test from 'node:test';
import { foundationRoutes } from './routes.js';
import { declaredRouteSurfaces, routeSurfaceFor } from './route-surface.js';

test('route surfaces default to the standard application shell', () => {
  assert.equal(routeSurfaceFor('foundation'), 'standard');
  assert.equal(routeSurfaceFor('unknown-route'), 'standard');
});

test('Customers is an explicit full-bleed replacement surface', () => {
  assert.equal(routeSurfaceFor('crm-customers'), 'full-bleed');
});

test('every explicit route surface belongs to a registered route', () => {
  const routeIds = new Set(foundationRoutes.map(route => route.id));
  for (const routeId of Object.keys(declaredRouteSurfaces())) {
    assert.equal(routeIds.has(routeId), true, routeId);
  }
});
