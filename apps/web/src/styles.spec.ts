import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const premiumTheme = readFileSync(new URL('./ui/themes/elhafez-premium.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');

test('responsive CSS prevents shell content from overflowing horizontally', () => {
  assert.match(styles, /overflow-x: clip/);
  assert.match(styles, /@media \(max-width: 900px\)/);
});

test('UI-02 centralizes page rhythm, form layout and dashboard patterns', () => {
  assert.match(styles, /\.ui-page-stack/);
  assert.match(styles, /\.ui-card form/);
  assert.match(styles, /\.ui-metric-grid/);
  assert.match(styles, /\.ui-filter-grid/);
});

test('premium visual layer is loaded separately from the canonical baseline', () => {
  assert.match(entry, /\.\/ui\/themes\/elhafez-premium\.css/);
  assert.match(entry, /applyUiPreferences\(DEFAULT_UI_PREFERENCES\)/);
  assert.doesNotMatch(styles, /ELHAFEZ Premium Theme/);
});

test('premium theme is explicitly gated and covers entry, shell and shared content primitives', () => {
  assert.match(premiumTheme, /html\[data-ui-theme='premium'\] \.tenant-entry-shell/);
  assert.match(premiumTheme, /html\[data-ui-theme='premium'\] \.app-sidebar/);
  assert.match(premiumTheme, /html\[data-ui-theme='premium'\] \.ui-card/);
  assert.match(premiumTheme, /html\[data-ui-theme='premium'\] \.ui-table-wrap/);
  assert.doesNotMatch(premiumTheme, /^\.app-sidebar/m);
  assert.doesNotMatch(premiumTheme, /^\.ui-card/m);
});
