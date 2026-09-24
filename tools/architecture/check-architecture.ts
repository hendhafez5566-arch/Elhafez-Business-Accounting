import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

interface ModuleMetadata {
  readonly name?: string;
  readonly publicApi?: string[];
  readonly ownedTables?: string[];
  readonly allowedDependencies?: string[];
}

const root = process.cwd();
const modulesDir = join(root, 'modules');
const schemaPath = join(root, 'prisma', 'schema.prisma');
const errors: string[] = [];
const sourceExtensions = new Set(['.ts', '.tsx']);
const canonicalWebCss = new Set(['apps/web/src/styles.css', 'apps/web/src/ui/design-tokens.css']);
const kernelPackages = new Set(['core', 'contracts']);

function filesIn(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    const extension = path.slice(path.lastIndexOf('.'));
    return sourceExtensions.has(extension) ? [path] : [];
  });
}

function importsOf(content: string): string[] {
  return [...content.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map(
    (match) => match[1]!,
  );
}

const moduleNames = readdirSync(modulesDir).filter(
  (name) => statSync(join(modulesDir, name)).isDirectory() && name !== '_template',
);
const moduleSet = new Set(moduleNames);
const metadataByModule = new Map<string, ModuleMetadata>();

for (const name of moduleNames) {
  const manifest = join(modulesDir, name, 'module.json');
  if (!existsSync(manifest)) {
    errors.push(`modules/${name}: module.json is required.`);
    continue;
  }
  const metadata = JSON.parse(readFileSync(manifest, 'utf8')) as ModuleMetadata;
  metadataByModule.set(name, metadata);

  if (metadata.name !== name) {
    errors.push(`modules/${name}: module.json name must equal directory name.`);
  }
  if (!metadata.publicApi?.includes('src/public/index.ts')) {
    errors.push(`modules/${name}: must expose src/public/index.ts as its public API.`);
  }
  if (!metadata.ownedTables?.length) {
    errors.push(`modules/${name}: must declare ownedTables.`);
  }
}

const tableOwner = new Map<string, string>();
for (const [name, metadata] of metadataByModule) {
  for (const table of metadata.ownedTables ?? []) {
    const existing = tableOwner.get(table);
    if (existing && existing !== name) {
      errors.push(
        `table ownership conflict: '${table}' is declared by both '${existing}' and '${name}'.`,
      );
    } else {
      tableOwner.set(table, name);
    }
  }
}

if (!existsSync(schemaPath)) {
  errors.push('prisma/schema.prisma is required.');
}

const schema = existsSync(schemaPath) ? readFileSync(schemaPath, 'utf8') : '';
const modelToTable = new Map<string, string>();
for (const match of schema.matchAll(/model\s+([A-Za-z_][\w]*)\s*\{([\s\S]*?)\n\}/g)) {
  const model = match[1]!;
  const body = match[2]!;
  const mapped = /@@map\("([^"]+)"\)/.exec(body)?.[1];
  modelToTable.set(model, mapped ?? model);
}

const schemaTables = new Set(modelToTable.values());
for (const [table, owner] of tableOwner) {
  if (!schemaTables.has(table)) {
    errors.push(
      `modules/${owner}/module.json: owned table '${table}' does not exist in prisma/schema.prisma.`,
    );
  }
}

const delegateOwner = new Map<string, string>();
for (const [model, table] of modelToTable) {
  const owner = tableOwner.get(table);
  if (owner) {
    delegateOwner.set(model.slice(0, 1).toLowerCase() + model.slice(1), owner);
  }
}

for (const packageName of kernelPackages) {
  const packageRoot = join(root, 'packages', packageName, 'src');
  for (const file of filesIn(packageRoot)) {
    const content = readFileSync(file, 'utf8');
    const from = relative(root, file).split(sep).join('/');
    for (const imported of importsOf(content)) {
      if (
        moduleNames.some(
          (moduleName) =>
            imported === `@elhafez/${moduleName}` ||
            imported.includes(`/modules/${moduleName}/`),
        )
      ) {
        errors.push(
          `${from}: shared kernel packages must not depend on business modules (${imported}).`,
        );
      }
      if (/^(?:@nestjs\/|@prisma\/|prisma$|react(?:\/|$))/.test(imported)) {
        errors.push(
          `${from}: shared contract/kernel code must not depend on framework or ORM package '${imported}'.`,
        );
      }
    }
  }
}

for (const name of moduleNames) {
  const metadata = metadataByModule.get(name);
  if (!metadata) continue;

  const declaredDependencies = metadata.allowedDependencies ?? [];
  for (const dependency of declaredDependencies) {
    if (!dependency.startsWith('@elhafez/')) continue;
    const dependencyName = dependency.slice('@elhafez/'.length);
    if (dependencyName === name) {
      errors.push(`modules/${name}: may not depend on itself.`);
    }
    if (!kernelPackages.has(dependencyName) && !moduleSet.has(dependencyName)) {
      errors.push(
        `modules/${name}: allowed dependency '${dependency}' does not identify a known module/kernel package.`,
      );
    }
  }

  const moduleRoot = join(modulesDir, name);
  for (const file of filesIn(join(moduleRoot, 'src'))) {
    const content = readFileSync(file, 'utf8');
    const from = relative(root, file).split(sep).join('/');
    const isDomain = from.includes('/src/domain/');

    for (const imported of importsOf(content)) {
      if (imported.includes('/modules/')) {
        errors.push(`${from}: absolute cross-module imports are forbidden (${imported}).`);
      }

      for (const other of moduleNames.filter((candidate) => candidate !== name)) {
        if (
          imported.includes(`../${other}/`) ||
          imported.includes(`/modules/${other}/`)
        ) {
          errors.push(`${from}: may not import module '${other}' private source.`);
        }
        if (imported === `@elhafez/${other}`) {
          if (!declaredDependencies.includes(imported)) {
            errors.push(
              `${from}: module '${other}' is not an allowed public dependency.`,
            );
          }
          if (isDomain) {
            errors.push(
              `${from}: domain layer may not import business module '${other}', even through its public API.`,
            );
          }
        }
      }

      if (
        isDomain &&
        /^(?:@nestjs\/|@prisma\/|prisma$|react(?:\/|$)|react-dom(?:\/|$))/.test(
          imported,
        )
      ) {
        errors.push(
          `${from}: domain layer must remain framework/ORM/UI independent ('${imported}').`,
        );
      }
    }

    if (
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+\w+/i.test(content) &&
      !from.includes('/infrastructure/')
    ) {
      errors.push(
        `${from}: raw writes may only be implemented in this module's infrastructure layer.`,
      );
    }

    for (const access of content.matchAll(
      /\b(?:db|prisma|tx|client)\.([A-Za-z_$][\w$]*)\b/g,
    )) {
      const delegate = access[1]!;
      const owner = delegateOwner.get(delegate);
      if (owner && owner !== name) {
        errors.push(
          `${from}: direct Prisma access to '${delegate}' belongs to module '${owner}'. Use its public application boundary instead.`,
        );
      }
    }
  }
}

const graph = new Map<string, string[]>();
for (const name of moduleNames) {
  const dependencies = (metadataByModule.get(name)?.allowedDependencies ?? [])
    .filter((dependency) => dependency.startsWith('@elhafez/'))
    .map((dependency) => dependency.slice('@elhafez/'.length))
    .filter((dependency) => moduleSet.has(dependency));
  graph.set(name, dependencies);
}

const visiting = new Set<string>();
const visited = new Set<string>();
const stack: string[] = [];

function visit(name: string): void {
  if (visited.has(name)) return;
  if (visiting.has(name)) {
    const start = stack.indexOf(name);
    const cycle = [...stack.slice(start), name];
    errors.push(`module dependency cycle detected: ${cycle.join(' -> ')}.`);
    return;
  }

  visiting.add(name);
  stack.push(name);
  for (const dependency of graph.get(name) ?? []) visit(dependency);
  stack.pop();
  visiting.delete(name);
  visited.add(name);
}

for (const name of moduleNames) visit(name);

const webSourceRoot = join(root, 'apps', 'web', 'src');
const requiredUiFoundation = [
  'apps/web/src/ui.tsx',
  'apps/web/src/ui/primitives.tsx',
  'apps/web/src/ui/icons.tsx',
  'apps/web/src/ui/navigation.tsx',
  'apps/web/src/ui/preferences.tsx',
  'apps/web/src/ui/design-tokens.css',
  'apps/web/src/app-shell.tsx',
  'apps/web/src/styles.css',
];
for (const required of requiredUiFoundation) {
  if (!existsSync(join(root, required))) errors.push(required + ': canonical UI foundation file is required.');
}

for (const file of filesIn(webSourceRoot)) {
  const from = relative(root, file).split(sep).join('/');
  const content = readFileSync(file, 'utf8');
  if (/style\s*=\s*\{\{/.test(content)) {
    errors.push(from + ': inline style objects are forbidden; use the central UI foundation and design tokens.');
  }

  const isUiFoundation = from === 'apps/web/src/ui.tsx' || from.startsWith('apps/web/src/ui/');
  const isTestFile = /\.spec\.tsx?$/.test(from);
  if (!isUiFoundation && !isTestFile && from.endsWith('.tsx') && /<(?:button|input|select|textarea)\b/.test(content)) {
    errors.push(from + ': raw form controls are forbidden in application pages; consume shared UI primitives from apps/web/src/ui.tsx.');
  }
}

function cssFilesIn(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return cssFilesIn(path);
    return path.endsWith('.css') ? [path] : [];
  });
}

for (const file of cssFilesIn(webSourceRoot)) {
  const from = relative(root, file).split(sep).join('/');
  if (!canonicalWebCss.has(from)) {
    errors.push(from + ': page/module CSS is forbidden; reusable styling belongs in the canonical UI foundation.');
  }
}

const uiFacadePath = join(root, 'apps', 'web', 'src', 'ui.tsx');
if (existsSync(uiFacadePath)) {
  const facade = readFileSync(uiFacadePath, 'utf8');
  if (!facade.includes("export * from './ui/primitives.js';")) {
    errors.push('apps/web/src/ui.tsx: must remain the stable facade over the canonical UI foundation.');
  }
}

const globalStylesPath = join(root, 'apps', 'web', 'src', 'styles.css');
if (existsSync(globalStylesPath)) {
  const styles = readFileSync(globalStylesPath, 'utf8');
  if (!styles.includes("@import './ui/design-tokens.css';")) {
    errors.push('apps/web/src/styles.css: must consume the canonical design tokens.');
  }
}

if (errors.length) {
  console.error(
    'Architecture check failed:\n' + errors.map((error) => `- ${error}`).join('\n'),
  );
  process.exit(1);
}

console.log(
  `Architecture check passed (${moduleNames.length} business modules, ${tableOwner.size} uniquely owned tables, dependency DAG verified; template excluded).`,
);
