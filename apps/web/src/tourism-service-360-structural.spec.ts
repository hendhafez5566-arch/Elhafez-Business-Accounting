import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./tourism-service-360-page.tsx', import.meta.url), 'utf8');

test('tourism service 360 uses the canonical profile workspace in place', () => {
  assert.match(source, /export function TourismService360Page/);
  assert.match(source, /SettingsWorkspace/);
  assert.match(source, /WorkspaceNavigation/);
  assert.match(source, /المالية والربحية/);
  assert.match(source, /التوريد والموردون/);
  assert.match(source, /التنفيذ والفواتشر/);
  assert.doesNotMatch(source, /<Tabs/);
  assert.doesNotMatch(source, /\/manage/);
});
