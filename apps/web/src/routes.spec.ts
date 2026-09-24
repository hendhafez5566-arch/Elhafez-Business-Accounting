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

test('appearance and navigation preferences have one canonical settings route', () => {
  const route = findRoute('/settings/appearance');
  assert.equal(route.id, 'appearance-settings');
  assert.equal(route.group, 'الإعدادات');
  assert.equal(route.icon, 'appearance');
});

test('duplicate route ids and paths are rejected before they can corrupt navigation', () => {
  assert.throws(() =>
    defineRoutes(
      { id: 'one', path: '/one', label: 'واحد', element: null },
      { id: 'one', path: '/two', label: 'اثنان', element: null },
    ),
  );
  assert.throws(() =>
    defineRoutes(
      { id: 'one', path: '/same', label: 'واحد', element: null },
      { id: 'two', path: '/same', label: 'اثنان', element: null },
    ),
  );
});
