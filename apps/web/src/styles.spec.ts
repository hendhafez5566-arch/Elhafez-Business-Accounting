import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const portal = readFileSync(new URL('./portal-home-page.css', import.meta.url), 'utf8');

test('clean stylesheet contains only current shell and rebuild foundations', () => {
  for (const selector of ['.app-shell', '.app-sidebar', '.app-topbar', '.clean-ui-reset-surface', '.tenant-entry-shell', '.ui-button']) {
    assert.ok(styles.includes(selector), `missing ${selector}`);
  }
  for (const removed of ['.ct-root', '.accounting-workspace', '.tourism-services-page', '.hajj-umrah-workspace']) {
    assert.equal(styles.includes(removed), false, `legacy selector remains: ${removed}`);
  }
});

test('portal stylesheet owns the seven-workspace cards', () => {
  assert.ok(portal.includes('.portal-home'));
  assert.ok(portal.includes('.portal-workspace-card'));
});
