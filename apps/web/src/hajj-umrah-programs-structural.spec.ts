import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./hajj-umrah-pages.tsx', import.meta.url), 'utf8');

test('Hajj program routes are structurally redesigned in their canonical owners', () => {
  assert.match(source, /export function ProgramsPage/);
  assert.match(source, /const programColumns/);
  assert.match(source, /export function ProgramWorkspacePage/);
  assert.match(source, /SplitWorkspace/);
  assert.match(source, /سجل الإصدارات/);
  assert.doesNotMatch(source, /<Tabs\b/);
});

test('Hajj programs do not introduce parallel manage owners', () => {
  assert.doesNotMatch(source, /\/manage/);
  assert.doesNotMatch(source, /ProgramsBoardPage|ProgramWorkspaceStructuralPage/);
});
