import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');

test('legacy accounting routes select an independent visible presentation identity', () => {
  const routes = source('./accounting-legacy-routes.tsx');
  const screens = [...routes.matchAll(/screen="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(screens.length, 19);
  assert.equal(new Set(screens).size, screens.length);
  assert.doesNotMatch(source('./accounting-legacy-route-page.tsx'), /AccountingWorkspaceView|onSectionChange|SettingsWorkspace/);
});

test('accounting replacement retains canonical behavior without a parallel persistence path', () => {
  const page = source('./accounting-legacy-route-page.tsx');
  assert.match(page, /screenPresentation/);
  assert.match(page, /AccountingSectionContent/);
  assert.match(page, /accountingApi\.overview/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|AccountingWorkspaceView/);
});
