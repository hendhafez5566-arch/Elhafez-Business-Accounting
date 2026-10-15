import test from 'node:test';
import assert from 'node:assert/strict';
import { foundationRoutes, findRoute } from './routes.js';

test('quotation route belongs to the same sales workspace as customers and is unique', () => {
  const route = findRoute('/crm/quotations');
  assert.equal(route.id, 'crm-quotations');
  assert.equal(route.group, findRoute('/crm/customers').group);
  assert.ok(route.group);
  assert.equal(foundationRoutes.filter(item => item.path === route.path).length, 1);
});
