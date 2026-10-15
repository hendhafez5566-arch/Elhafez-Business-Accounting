import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const checker = join(root, 'tools/architecture/check-architecture.ts');

function checkSection(files: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), 'elhafez-ui-policy-'));
  const write = (path: string, value: string) => {
    const target = join(directory, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, value);
  };
  try {
    mkdirSync(join(directory, 'modules'), { recursive: true });
    write('prisma/schema.prisma', '');
    for (const path of ['app-shell.tsx', 'ui/icons.tsx', 'ui/navigation.tsx', 'ui/preferences.tsx', 'ui/primitives.tsx', 'ui/design-tokens.css']) write('apps/web/src/' + path, '');
    write('apps/web/src/ui.tsx', "export * from './ui/primitives.js';");
    write('apps/web/src/styles.css', "@import './ui/design-tokens.css';");
    for (const [path, value] of Object.entries(files)) write(path, value);
    return spawnSync(process.execPath, ['--import', join(root, 'node_modules/tsx/dist/loader.mjs'), checker], { cwd: directory, encoding: 'utf8', env: { ...process.env, NODE_PATH: join(root, 'node_modules') } });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('every section can own a different scoped layout, native controls and element-local styles', () => {
  const result = checkSection({
    'apps/web/src/features/customers/page.tsx': 'export const Page = () => <section style={{display:"grid"}}><button>Open</button><input aria-label="Search" /></section>;',
    'apps/web/src/features/customers/page.module.css': '.layout { display:grid; grid-template-columns: 1fr 2fr; } @media (max-width: 700px) { .layout { display:block; } }',
    'apps/web/src/features/suppliers/page.module.css': '.layout { display:flex; } .layout :is(button, input) { margin:0; }',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('section rules support nested styles, animation and data attributes without global CSS', () => {
  const result = checkSection({ 'apps/web/src/rooming.module.css': '.layout { color: var(--color-text); &[data-active="yes"] { opacity:1; } } @keyframes reveal { from {opacity:0} to {opacity:1} }' });
  assert.equal(result.status, 0, result.stderr);
});

test('unscoped page styles and CSS Module escape hatches remain rejected', () => {
  for (const [path, css] of Object.entries({
    'apps/web/src/customer.css': '.layout {color:red}',
    'apps/web/src/global.module.css': ':global(body) {color:red}',
    'apps/web/src/import.module.css': '@import "../styles.css";',
    'apps/web/src/composition.module.css': '.layout {composes: shared from global}',
    'apps/web/src/body.module.css': 'body {color:red}',
    'apps/web/src/comma.module.css': '.layout, html {color:red}',
    'apps/web/src/container.module.css': '@media (min-width: 1px) { * {color:red} }',
  })) {
    const result = checkSection({ [path]: css });
    assert.equal(result.status, 1, path + ': ' + result.stdout + result.stderr);
    assert.match(result.stderr, /section|CSS Modules/, path);
  }
});

test('presentation flexibility never permits domain code to depend on React', () => {
  const result = checkSection({
    'modules/example/module.json': JSON.stringify({name:'example', publicApi:['src/public/index.ts'], ownedTables:['example_records'], allowedDependencies:[]}),
    'prisma/schema.prisma': 'model ExampleRecord {\n id String @id\n @@map("example_records")\n}',
    'modules/example/src/domain/example.ts': "import React from 'react'; export const element = React;",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /domain layer must remain framework\/ORM\/UI independent/);
});

test('actual browser bundler isolates identical class names in different section modules', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'elhafez-css-build-'));
  try {
    writeFileSync(join(directory, 'customers.module.css'), '.layout { color: red; display:grid; }');
    writeFileSync(join(directory, 'suppliers.module.css'), '.layout { color: blue; display:flex; }');
    writeFileSync(join(directory, 'entry.js'), 'import customers from "./customers.module.css"; import suppliers from "./suppliers.module.css"; console.log(customers.layout,suppliers.layout);');
    await build({entryPoints:[join(directory,'entry.js')], bundle:true, outdir:join(directory,'dist'), minify:false});
    const css = readFileSync(join(directory,'dist/entry.css'),'utf8');
    assert.match(css, /\.customers_layout/);
    assert.match(css, /\.suppliers_layout/);
    assert.doesNotMatch(css, /(?:^|\n)\.layout\s*\{/);
  } finally { rmSync(directory, { recursive:true, force:true }); }
});
