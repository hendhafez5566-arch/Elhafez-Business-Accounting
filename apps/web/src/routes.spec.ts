import assert from 'node:assert/strict';
import test from 'node:test';
import { defineRoutes, findRoute, foundationRoutes, type AppRoute } from './routes.js';

const labels = [
  'الرئيسية',
  'الحج والعمرة',
  'المبيعات والعملاء',
  'الخدمات السياحية',
  'المشتريات والموردون',
  'المحاسبة والمالية',
  'التقارير والرقابة',
  'الإدارة والإعدادات',
];

test('clean route registry contains only portal and seven workspaces', () => {
  assert.equal(foundationRoutes.length, 8);
  assert.deepEqual(foundationRoutes.map(route => route.label), labels);
  for (const route of foundationRoutes) assert.equal('element' in route, false);
});

test('route registry rejects duplicate ids and paths', () => {
  const route: AppRoute = { id: 'one', path: '/one', label: 'واحد', design: { blueprint: 'workspace', reference: 'one' } };
  assert.throws(() => defineRoutes(route, { ...route, path: '/two' }), /Duplicate route id/);
  assert.throws(() => defineRoutes(route, { ...route, id: 'two' }), /Duplicate route path/);
});

test('route lookup normalizes query strings and falls back to clean portal', () => {
  assert.equal(findRoute('/accounting/?tab=old').id, 'accounting');
  assert.equal(findRoute('/removed/legacy/page').id, 'foundation');
});
