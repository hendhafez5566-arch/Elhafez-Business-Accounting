import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('./ui/design-tokens.css', import.meta.url), 'utf8');
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

test('Gemini Pro reference design is implemented through the canonical tokens and shared primitives', () => {
  assert.match(tokens, /GEMINI PRO REFERENCE FOUNDATION/);
  assert.match(tokens, /html\[data-ui-theme='gemini'\] \.app-sidebar/);
  assert.match(tokens, /html\[data-ui-theme='gemini'\] \.app-topbar/);
  assert.match(tokens, /html\[data-ui-theme='gemini'\] \.ui-card/);
  assert.match(tokens, /html\[data-ui-theme='gemini'\] \.ui-table-wrap/);
  assert.match(tokens, /html\[data-ui-theme='gemini'\] \.ui-tabs/);
  assert.match(tokens, /html\[data-ui-theme='gemini'\] \.ui-metric-card/);
});

test('premium visual layer remains inside the canonical UI stylesheet as a rollback option', () => {
  assert.match(entry, /applyUiPreferences\(DEFAULT_UI_PREFERENCES\)/);
  assert.doesNotMatch(entry, /ui\/themes\/.*\.css/);
  assert.match(styles, /BEGIN ELHAFEZ PREMIUM THEME/);
  assert.match(styles, /END ELHAFEZ PREMIUM THEME/);
});

test('premium theme is explicitly gated and covers entry, shell and shared content primitives', () => {
  assert.match(styles, /html\[data-ui-theme='premium'\] \.tenant-entry-shell/);
  assert.match(styles, /html\[data-ui-theme='premium'\] \.app-sidebar/);
  assert.match(styles, /html\[data-ui-theme='premium'\] \.ui-card/);
  assert.match(styles, /html\[data-ui-theme='premium'\] \.ui-table-wrap/);
});