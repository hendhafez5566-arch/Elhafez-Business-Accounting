import assert from 'node:assert/strict';
import test from 'node:test';
import { foundationRoutes } from './routes.js';

test('route registry forbids hidden manage mirrors and parallel UI owners', () => {
  const forbidden = foundationRoutes.filter((route) =>
    route.path.endsWith('/manage') || route.id.endsWith('-manage'),
  );

  assert.deepEqual(
    forbidden.map((route) => ({ id: route.id, path: route.path })),
    [],
    'A redesign must replace the canonical page structure in-place. Do not keep the old page on a hidden /manage route.',
  );
});

test('every canonical path has exactly one UI owner', () => {
  const counts = new Map<string, number>();
  for (const route of foundationRoutes) {
    counts.set(route.path, (counts.get(route.path) ?? 0) + 1);
  }

  assert.deepEqual(
    [...counts.entries()].filter(([, count]) => count !== 1),
    [],
    'Each functional route must have exactly one canonical UI owner.',
  );
});
