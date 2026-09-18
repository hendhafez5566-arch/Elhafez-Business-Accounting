import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
test('responsive CSS prevents shell content from overflowing horizontally', () => {
  assert.match(styles, /overflow-x: clip/);
  assert.match(styles, /@media \(max-width: 900px\)/);
});
