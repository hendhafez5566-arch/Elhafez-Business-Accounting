import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./hajj-umrah-operations-primary-pages.tsx', import.meta.url), 'utf8');

test('Hajj primary operations redesigns the canonical owners in place', () => {
  assert.match(source, /export function BookingsPage/);
  assert.match(source, /export function RoomingPage/);
  assert.match(source, /export function VisasPage/);
  assert.match(source, /مصفوفة توزيع الغرف/);
  assert.match(source, /SplitWorkspace/);
});

test('primary operations do not contain parallel manage UI owners', () => {
  assert.doesNotMatch(source, /\/manage/);
  assert.doesNotMatch(source, /StructuralPage|WorkspacePage/);
});
