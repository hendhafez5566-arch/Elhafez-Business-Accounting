import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const approval = readFileSync(new URL('./approval-center-page.tsx', import.meta.url), 'utf8');
const notifications = readFileSync(new URL('./notification-center-page.tsx', import.meta.url), 'utf8');

test('approval center uses canonical navigation and master-detail composition in place', () => {
  assert.match(approval, /export function ApprovalCenterPage/);
  assert.match(approval, /SettingsWorkspace/);
  assert.match(approval, /MasterDetailWorkspace/);
  assert.match(approval, /WorkspaceNavigation/);
  assert.doesNotMatch(approval, /<Tabs/);
  assert.doesNotMatch(approval, /ui-page-stack/);
  assert.doesNotMatch(approval, /\/manage/);
});

test('notification center uses canonical filter navigation and master-detail composition in place', () => {
  assert.match(notifications, /export function NotificationCenterPage/);
  assert.match(notifications, /MasterDetailWorkspace/);
  assert.match(notifications, /WorkspaceNavigation/);
  assert.doesNotMatch(notifications, /<Tabs/);
  assert.doesNotMatch(notifications, /\/manage/);
});
