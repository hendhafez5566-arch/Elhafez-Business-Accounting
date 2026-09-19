import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface SafetyConfig {
  readonly protectedPaths: string[];
  readonly generatedOrForbiddenPaths: string[];
}

interface ChangeManifest {
  readonly id: string;
  readonly summary: string;
  readonly type: 'feature' | 'bugfix' | 'phase' | 'architecture' | 'governance';
  readonly allowedModules: string[];
  readonly allowedPaths: string[];
  readonly protectedPaths: string[];
  readonly protectedReason: string;
  readonly allowBreakingPublicApi: boolean;
  readonly publicApiBreakingReason: string;
}

interface DiffEntry {
  readonly status: string;
  readonly oldPath?: string;
  readonly path: string;
}

const root = process.cwd();
const configPath = join(root, '.governance', 'change-safety.json');
const errors: string[] = [];

if (!existsSync(configPath)) {
  console.error('Change safety failed: .governance/change-safety.json is required.');
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, 'utf8')) as SafetyConfig;
const base = resolveBase();
const entries = readDiff(base);
const changedPaths = new Set(entries.flatMap((entry) => [entry.oldPath, entry.path].filter(Boolean) as string[]));

if (entries.length === 0) {
  console.log('Change safety passed (no changes relative to base).');
  process.exit(0);
}

const scopeEntries = entries.filter(
  (entry) => entry.path.startsWith('.changes/') && entry.path.endsWith('.json') && entry.status !== 'D',
);
const requireScope =
  process.env.REQUIRE_CHANGE_SCOPE === 'true' ||
  (process.env.REQUIRE_CHANGE_SCOPE !== 'false' && currentBranch() !== 'main');

if (requireScope && scopeEntries.length !== 1) {
  errors.push(
    `exactly one changed .changes/*.json manifest is required; found ${scopeEntries.length}.`,
  );
}

let manifest: ChangeManifest | undefined;
if (scopeEntries.length === 1) {
  manifest = parseManifest(scopeEntries[0]!.path);
  validateManifest(manifest);
}

for (const entry of entries) {
  const paths = [entry.oldPath, entry.path].filter(Boolean) as string[];
  for (const path of paths) {
    if (config.generatedOrForbiddenPaths.some((pattern) => matches(pattern, path))) {
      errors.push(`${path}: generated/forbidden artifact must not be committed.`);
    }
  }

  if (
    paths.some((path) => path.startsWith('prisma/migrations/')) &&
    !entry.status.startsWith('A')
  ) {
    errors.push(
      `${paths.join(' -> ')}: accepted historical migrations are immutable; add a new migration instead.`,
    );
  }
}

if (manifest) {
  for (const entry of entries) {
    const path = entry.path;
    if (path === scopeEntries[0]!.path) continue;

    const moduleMatch = /^modules\/([^/]+)\//.exec(path);
    if (moduleMatch) {
      const moduleName = moduleMatch[1]!;
      if (!manifest.allowedModules.includes(moduleName)) {
        errors.push(
          `${path}: module '${moduleName}' is outside the declared allowedModules change scope.`,
        );
      }
    } else if (!manifest.allowedPaths.some((pattern) => matches(pattern, path))) {
      errors.push(`${path}: path is outside the declared allowedPaths change scope.`);
    }

    const protectedMatches = config.protectedPaths.filter((pattern) => matches(pattern, path));
    if (protectedMatches.length > 0) {
      const explicitlyAllowed = manifest.protectedPaths.some((pattern) => matches(pattern, path));
      if (!explicitlyAllowed) {
        errors.push(
          `${path}: protected path changed without an explicit protectedPaths declaration.`,
        );
      }
      if (!manifest.protectedReason.trim()) {
        errors.push(`${path}: protected path change requires protectedReason.`);
      }
    }
  }

  checkPublicApiCompatibility(base, entries, manifest);
}

if (errors.length) {
  console.error('Change safety failed:\n' + errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(
  `Change safety passed (base ${base.slice(0, 12)}, ${entries.length} changed entries${manifest ? `, scope ${manifest.id}` : ''}).`,
);

function resolveBase(): string {
  if (process.env.CHANGE_BASE_SHA?.trim()) return process.env.CHANGE_BASE_SHA.trim();

  try {
    return git(['merge-base', 'HEAD', 'origin/main']).trim();
  } catch {
    try {
      return git(['rev-parse', 'HEAD^']).trim();
    } catch {
      return git(['rev-parse', 'HEAD']).trim();
    }
  }
}

function readDiff(baseSha: string): DiffEntry[] {
  const output = git(['diff', '--name-status', `${baseSha}...HEAD`]).trim();
  if (!output) return [];
  return output.split('\n').map((line) => {
    const parts = line.split('\t');
    const status = parts[0]!;
    if (status.startsWith('R') || status.startsWith('C')) {
      return { status, oldPath: parts[1]!, path: parts[2]! };
    }
    return { status, path: parts[1]! };
  });
}

function currentBranch(): string {
  try {
    return git(['branch', '--show-current']).trim();
  } catch {
    return '';
  }
}

function parseManifest(path: string): ChangeManifest {
  try {
    return JSON.parse(readFileSync(join(root, path), 'utf8')) as ChangeManifest;
  } catch (error) {
    errors.push(`${path}: invalid JSON change manifest (${String(error)}).`);
    return {
      id: '',
      summary: '',
      type: 'feature',
      allowedModules: [],
      allowedPaths: [],
      protectedPaths: [],
      protectedReason: '',
      allowBreakingPublicApi: false,
      publicApiBreakingReason: '',
    };
  }
}

function validateManifest(value: ChangeManifest): void {
  if (!value.id?.trim()) errors.push('change manifest: id is required.');
  if (!value.summary?.trim()) errors.push('change manifest: summary is required.');
  if (!['feature', 'bugfix', 'phase', 'architecture', 'governance'].includes(value.type)) {
    errors.push('change manifest: type is invalid.');
  }
  for (const key of ['allowedModules', 'allowedPaths', 'protectedPaths'] as const) {
    if (!Array.isArray(value[key])) errors.push(`change manifest: ${key} must be an array.`);
  }
  if (value.protectedPaths?.length && !value.protectedReason?.trim()) {
    errors.push('change manifest: protectedReason is required when protectedPaths is non-empty.');
  }
  if (value.allowBreakingPublicApi && !value.publicApiBreakingReason?.trim()) {
    errors.push(
      'change manifest: publicApiBreakingReason is required when allowBreakingPublicApi is true.',
    );
  }
}

function checkPublicApiCompatibility(
  baseSha: string,
  diffEntries: DiffEntry[],
  scope: ChangeManifest,
): void {
  for (const entry of diffEntries) {
    const path = entry.path;
    if (!/^modules\/[^/]+\/src\/public\/index\.ts$/.test(path)) continue;

    const before = show(baseSha, entry.oldPath ?? path);
    const after = existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : '';
    const removed = [...exportedSymbols(before)].filter((symbol) => !exportedSymbols(after).has(symbol));
    if (removed.length && !scope.allowBreakingPublicApi) {
      errors.push(
        `${path}: public API symbols removed without explicit breaking-change approval: ${removed.join(', ')}.`,
      );
    }
  }
}

function exportedSymbols(content: string): Set<string> {
  const result = new Set<string>();
  for (const match of content.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from/g)) {
    addNamed(match[1]!, result);
  }
  for (const match of content.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}\s*;/g)) {
    addNamed(match[1]!, result);
  }
  for (const match of content.matchAll(
    /export\s+(?:declare\s+)?(?:class|interface|type|const|function|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    result.add(match[1]!);
  }
  for (const match of content.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)) {
    result.add(`*:${match[1]!}`);
  }
  return result;
}

function addNamed(block: string, target: Set<string>): void {
  for (const raw of block.split(',')) {
    const cleaned = raw
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    if (!cleaned) continue;
    const withoutType = cleaned.replace(/^type\s+/, '');
    const sourceName = withoutType.split(/\s+as\s+/)[0]?.trim();
    if (sourceName) target.add(sourceName);
  }
}

function show(baseSha: string, path: string): string {
  try {
    return git(['show', `${baseSha}:${path}`]);
  } catch {
    return '';
  }
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function matches(pattern: string, path: string): boolean {
  const escaped = pattern.replace(/[.+^$(){}|\[\]\\]/g, '\\$&');
  const regex = escaped
    .replace(/\*\*/g, '§DOUBLESTAR§')
    .replace(/\*/g, '[^/]*')
    .replace(/§DOUBLESTAR§/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${regex}$`).test(path);
}
