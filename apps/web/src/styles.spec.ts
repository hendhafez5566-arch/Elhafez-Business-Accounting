import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
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
