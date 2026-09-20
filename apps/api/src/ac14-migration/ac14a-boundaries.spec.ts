import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// apps/api/src/ac14-migration -> repo root
const repoRoot = join(here, '..', '..', '..', '..');
const platformCoreSrc = join(repoRoot, 'modules', 'platform-core', 'src');

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function importsOf(content: string): string[] {
  return [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

test('Platform Core migration-control source imports no accounting business module', () => {
  assert.ok(statSync(platformCoreSrc).isDirectory());
  const allowed = new Set(['@elhafez/contracts', '@elhafez/core']);
  const accountingModuleHint = /@elhafez\/(?!contracts|core|platform-core)[a-z-]+/;

  for (const file of filesUnder(platformCoreSrc)) {
    for (const spec of importsOf(readFileSync(file, 'utf8'))) {
      if (spec.startsWith('@elhafez/')) {
        assert.ok(
          allowed.has(spec) || spec === '@elhafez/platform-core',
          `${file} imports ${spec}, which platform-core/module.json does not allow`,
        );
        assert.ok(
          !accountingModuleHint.test(spec) || allowed.has(spec),
          `${file} imports an accounting module (${spec}); Platform Core must not depend on business modules`,
        );
      }
    }
  }
});

test('this apps/api AC-14A skeleton imports platform capabilities only through the @elhafez/platform-core public root', () => {
  const skeletonFiles = filesUnder(here).filter((f) => !f.endsWith('.spec.ts'));
  for (const file of skeletonFiles) {
    for (const spec of importsOf(readFileSync(file, 'utf8'))) {
      if (spec.includes('platform-core')) {
        assert.equal(
          spec,
          '@elhafez/platform-core',
          `${file} must import Platform Core via its public package root only, found ${spec}`,
        );
      }
    }
  }
});

test('the new Prisma migration-control adapter only reads/writes pcMigration* models', () => {
  const adapterPath = join(platformCoreSrc, 'infrastructure', 'prisma-migration-control.repository.ts');
  const content = readFileSync(adapterPath, 'utf8');
  const prismaAccesses = [...content.matchAll(/this\.prisma\.(\w+)\./g)].map((m) => m[1]!);
  assert.ok(prismaAccesses.length > 0, 'expected the adapter to actually touch Prisma models');
  for (const model of new Set(prismaAccesses)) {
    assert.ok(
      model.startsWith('pcMigration'),
      `prisma-migration-control.repository.ts touches ${model}, which is not a pc_migration_* owned table`,
    );
  }
});
