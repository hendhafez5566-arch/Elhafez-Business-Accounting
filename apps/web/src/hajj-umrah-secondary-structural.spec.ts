import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./hajj-umrah-operations-secondary-pages.tsx', import.meta.url), 'utf8');

test('Hajj secondary operations are structurally redesigned in their canonical owners', () => {
  assert.match(source, /export function TicketingPage/);
  assert.match(source, /export function TransportPage/);
  assert.match(source, /export function TripOperationsPage/);
  assert.match(source, /SplitWorkspace/);
  assert.doesNotMatch(source, /<Tabs\b/);
});

test('secondary operations do not introduce hidden manage mirrors', () => {
  assert.doesNotMatch(source, /\/manage/);
  assert.doesNotMatch(source, /StructuralPage|WorkspacePage/);
});
