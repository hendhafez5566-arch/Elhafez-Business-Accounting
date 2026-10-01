import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
const customers = readFileSync(new URL('./crm-party-pages.tsx', import.meta.url), 'utf8');
const templateStyles = readFileSync(new URL('./pages/crm-customers/customers.css', import.meta.url), 'utf8');

test('Customers owns one route-scoped stylesheet with no inline duplicate or shell-hiding workaround', () => {
  assert.match(entry, /import '\.\/pages\/crm-customers\/customers\.css';/);
  assert.doesNotMatch(customers, /customers\.css/);
  assert.doesNotMatch(customers, /TEMPLATE_CSS/);
  assert.doesNotMatch(customers, /<style>/);
  assert.match(templateStyles, /page-style-owner: crm-customers/);
  assert.match(templateStyles, /\.ct-root\{/);
  assert.match(templateStyles, /\.ct-sheet--on\{transform:none\}/);
  assert.match(templateStyles, /\.ct-fab\{/);
  assert.doesNotMatch(templateStyles, /:has\(/);
  assert.doesNotMatch(templateStyles, /\.app-shell/);
  assert.doesNotMatch(templateStyles, /\.app-sidebar/);
  assert.doesNotMatch(templateStyles, /\.app-topbar/);
});
