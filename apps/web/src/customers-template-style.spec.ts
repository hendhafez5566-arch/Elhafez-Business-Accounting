import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
const templateStyles = readFileSync(new URL('../customers-template.css', import.meta.url), 'utf8');

test('the supplied Customers template is bundled as an external stylesheet and owns the full customer route surface', () => {
  assert.match(entry, /import '\.\.\/customers-template\.css';/);
  assert.match(templateStyles, /\.ct-root\{/);
  assert.match(templateStyles, /\.ct-sheet--on\{transform:none\}/);
  assert.match(templateStyles, /\.app-shell:has\(\.ct-root\)>.app-sidebar/);
  assert.match(templateStyles, /\.ct-fab\{/);
});
