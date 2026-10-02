import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const routeTokens = (text: string, field: 'path' | 'id') => [...text.matchAll(new RegExp(`${field}: '([^']+)'`, 'g'))].map((match) => match[1]!);

function assertUnique(values: readonly string[], label: string) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  assert.deepEqual([...new Set(duplicates)], [], `duplicate ${label}: ${[...new Set(duplicates)].join(', ')}`);
}

test('Phase 2 route registry has one active route owner per id and path across all spread registries', () => {
  const root = source('./routes.tsx');
  const accounting = source('./accounting-legacy-routes.tsx');
  const batchC = source('./phase2-batch-c-routes.tsx');
  const paths = [...routeTokens(root, 'path'), ...routeTokens(accounting, 'path'), ...routeTokens(batchC, 'path')];
  const ids = [...routeTokens(root, 'id'), ...routeTokens(accounting, 'id'), ...routeTokens(batchC, 'id')];
  assertUnique(paths, 'path');
  assertUnique(ids, 'id');
  assert.equal(paths.length, ids.length);
  assert.ok(paths.length >= 70, `expected complete Phase 2 route surface, got ${paths.length}`);
});

test('Phase 2 replacement surface contains no manage mirrors, v2 route owners or duplicate business persistence', () => {
  const files = [
    './routes.tsx',
    './accounting-legacy-route-page.tsx',
    './accounting-legacy-routes.tsx',
    './hajj-umrah-dashboard-page.tsx',
    './reports-control-legacy-pages.tsx',
    './administration-legacy-pages.tsx',
    './phase2-batch-c-routes.tsx',
  ];
  const combined = files.map(source).join('\n');
  assert.doesNotMatch(combined, /path:\s*['"]\/manage(?:\/|['"])/);
  assert.doesNotMatch(combined, /path:\s*['"][^'"]*v2(?:\/|['"])/i);
  assert.doesNotMatch(combined, /sessionStorage|ts-ignore|\bany\b/);
  assert.doesNotMatch(source('./accounting-legacy-route-page.tsx'), /localStorage/);
  assert.doesNotMatch(source('./reports-control-legacy-pages.tsx'), /localStorage/);
  assert.doesNotMatch(source('./administration-legacy-pages.tsx'), /localStorage/);
});

test('Phase 1 shell ownership remains present and is not replaced by Phase 2 route adapters', () => {
  const routes = source('./routes.tsx');
  assert.match(routes, /PortalHomePage/);
  assert.match(routes, /path: '\/'/);
  assert.match(routes, /navigation: false/);
  for (const forbidden of ['login-page', 'app-shell', 'sidebar', 'topbar', 'print-preview']) {
    assert.doesNotMatch(source('./phase2-batch-c-routes.tsx'), new RegExp(forbidden, 'i'));
  }
});

test('Batch C exposes exactly six Reports Control and eleven Administration legacy navigation entries', () => {
  const registry = source('./phase2-batch-c-routes.tsx');
  const reportBlock = registry.slice(registry.indexOf('reportsControlLegacyRoutes'), registry.indexOf('administrationLegacyRoutes'));
  const adminBlock = registry.slice(registry.indexOf('administrationLegacyRoutes'), registry.indexOf('phase2BatchCLegacyRoutes'));
  assert.equal(routeTokens(reportBlock, 'path').length, 6);
  assert.equal(routeTokens(adminBlock, 'path').length, 11);
});
