import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isScreenDesign } from './ui/screen-layouts.js';

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const targets = [
  './supplier-intelligence-page.tsx',
  './system-administration-page.tsx',
  './reporting-center-page.tsx',
  './platform-foundations-page.tsx',
  './quotation-pages.tsx',
] as const;

test('final structural owners do not restore primary Tabs or nested page stacks', () => {
  for (const file of targets) {
    const text = source(file);
    assert.doesNotMatch(text, /\bTabs\b/, `${file} must use its registered structural workspace, not primary Tabs`);
    assert.doesNotMatch(text, /className=["']ui-page-stack["']/, `${file} must not create a second page shell below App Shell`);
  }
});

test('registered routes retain one canonical owner and no hidden manage mirrors', () => {
  const routes = source('./routes.tsx');
  const declarations = [...routes.matchAll(/\{ id: '([^']+)', path: '([^']+)'[^\n]+design: \{ blueprint: '([^']+)', reference: '([^']+)' \}/g)];
  assert.ok(declarations.length > 0, 'route registry declarations must remain structurally inspectable');
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const [, id, path, blueprint, reference] of declarations) {
    assert.ok(!ids.has(id!), `${id} has a second UI owner`);
    assert.ok(!paths.has(path!), `${path} has a second UI owner`);
    assert.doesNotMatch(path!, /(?:^|\/)manage(?:\/|$)/, `${path} is a hidden manage mirror`);
    assert.ok(isScreenDesign({ blueprint, reference }), `${id} bypasses ScreenDesign`);
    ids.add(id!);
    paths.add(path!);
  }
});

test('five closure routes keep their authoritative structural contracts', () => {
  const routes = source('./routes.tsx');
  const expected = [
    ["supplier-intelligence", "profile", "supplier-intelligence"],
    ["system-administration", "settings", "system-administration"],
    ["management-reports", "dashboard", "financial-reporting-center"],
    ["system-custom-fields", "settings", "company-system-settings"],
    ["system-document-numbering", "settings", "company-system-settings"],
    ["system-automation", "command-center", "team-task-workflow"],
    ["crm-quotations", "stepper", "quotation-stepper"],
  ] as const;
  for (const [id, blueprint, reference] of expected) {
    const contract = new RegExp(`id: '${id}'[^\\n]+design: \\{ blueprint: '${blueprint}', reference: '${reference}' \\}`);
    assert.match(routes, contract, `missing or changed structural contract for ${id}`);
  }
});
