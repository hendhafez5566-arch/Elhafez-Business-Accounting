import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const customer = readFileSync(new URL('./crm-360-parity-pages.tsx', import.meta.url), 'utf8');
const agent = readFileSync(new URL('./crm-agent-parity-pages.tsx', import.meta.url), 'utf8');

test('customer 360 uses the canonical profile workspace in place', () => {
  assert.match(customer, /export function Customer360Page/);
  assert.match(customer, /SettingsWorkspace/);
  assert.match(customer, /WorkspaceNavigation/);
  assert.doesNotMatch(customer, /<Tabs/);
  assert.doesNotMatch(customer, /\/manage/);
});

test('agent 360 uses the canonical profile workspace in place', () => {
  assert.match(agent, /export function Agent360Page/);
  assert.match(agent, /SettingsWorkspace/);
  assert.match(agent, /WorkspaceNavigation/);
  assert.doesNotMatch(agent, /<Tabs/);
  assert.doesNotMatch(agent, /\/manage/);
});
