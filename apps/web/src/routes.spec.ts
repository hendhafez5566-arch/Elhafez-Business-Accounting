import assert from 'node:assert/strict';
import test from 'node:test';
import { defineRoutes, findRoute, foundationRoutes } from './routes.js';

test('routing has a shell-only Arabic-first fallback route', () => {
  assert.equal(foundationRoutes[0]?.label, 'الرئيسية');
  assert.equal(findRoute('/missing').id, 'foundation');
});

test('future route registration is separated from shell presentation', () => {
  const routes = defineRoutes({ id: 'extension', path: '/extension', label: 'امتداد', element: null });
  assert.equal(findRoute('/extension', routes).id, 'extension');
});
