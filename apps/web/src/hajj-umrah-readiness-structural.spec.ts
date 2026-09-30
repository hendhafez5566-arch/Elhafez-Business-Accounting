import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./hajj-umrah-readiness-page.tsx', import.meta.url), 'utf8');

test('Hajj readiness redesigns the canonical owner in place', () => {
  assert.match(source, /export function HajjUmrahReadinessPage/);
  assert.match(source, /export function ReadinessWorkspaceView/);
  assert.match(source, /SplitWorkspace/);
  assert.match(source, /الجاهزية والموانع/);
  assert.match(source, /قائمة العمل الحالية/);
  assert.match(source, /مركز الحجز 360°/);
});

test('Hajj readiness no longer uses the legacy tab shell or parallel manage routes', () => {
  assert.doesNotMatch(source, /<Tabs/);
  assert.doesNotMatch(source, /\/manage/);
  assert.doesNotMatch(source, /StructuralPage/);
});
