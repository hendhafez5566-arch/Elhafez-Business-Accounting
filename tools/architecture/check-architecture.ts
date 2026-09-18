import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const modulesDir = join(root, 'modules');
const errors: string[] = [];
const sourceExtensions = new Set(['.ts', '.tsx']);

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : sourceExtensions.has(path.slice(path.lastIndexOf('.'))) ? [path] : [];
  });
}

const moduleNames = readdirSync(modulesDir).filter((name) => statSync(join(modulesDir, name)).isDirectory() && name !== '_template');
for (const name of moduleNames) {
  const moduleRoot = join(modulesDir, name);
  const manifest = join(moduleRoot, 'module.json');
  if (!existsSync(manifest)) {
    errors.push(`modules/${name}: module.json is required.`);
    continue;
  }
  const metadata = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string; publicApi?: string[]; ownedTables?: string[]; allowedDependencies?: string[] };
  if (metadata.name !== name) errors.push(`modules/${name}: module.json name must equal directory name.`);
  if (!metadata.publicApi?.includes('src/public/index.ts')) errors.push(`modules/${name}: must expose src/public/index.ts as its public API.`);
  if (!metadata.ownedTables?.length) errors.push(`modules/${name}: must declare ownedTables.`);
  for (const file of filesIn(join(moduleRoot, 'src'))) {
    const content = readFileSync(file, 'utf8');
    const from = relative(root, file).split(sep).join('/');
    const imports = [...content.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]!);
    for (const imported of imports) {
      if (imported.includes('/modules/')) errors.push(`${from}: absolute cross-module imports are forbidden (${imported}).`);
      for (const other of moduleNames.filter((candidate) => candidate !== name)) {
        if (imported.includes(`../${other}/`) || imported.includes(`/modules/${other}/`) || imported === `@elhafez/${other}`) {
          errors.push(`${from}: may not import module '${other}' directly. Use a public contract or an event.`);
        }
      }
    }
    if (/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+\w+/i.test(content) && !from.includes('/infrastructure/')) {
      errors.push(`${from}: writes may only be implemented in this module's infrastructure layer.`);
    }
  }
}

const schema = join(root, 'prisma/schema.prisma');
if (!existsSync(schema)) errors.push('prisma/schema.prisma is required.');
if (errors.length) {
  console.error('Architecture check failed:\n' + errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`Architecture check passed (${moduleNames.length} business modules; template excluded).`);
