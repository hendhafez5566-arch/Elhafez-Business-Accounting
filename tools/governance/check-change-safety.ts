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
  readonly testEvidence?: string[];
  readonly unacceptedMigrationRepairs?: string[];
  readonly unacceptedMigrationRepairReason?: string;
  readonly historicalMigrationIdentifierRepairs?: Array<{
    readonly path: string;
    readonly reason: string;
    readonly renames: Array<{ readonly from: string; readonly to: string }>;
  }>;
}

interface DiffEntry {
  readonly status: string;
  readonly oldPath?: string;
  readonly path: string;
}

interface MigrationRepairLock {
  readonly version: number;
  readonly repairs: Array<{
    readonly path: string;
    readonly baseBlobSha: string;
    readonly repairedBlobSha: string;
    readonly reason: string;
  }>;
}

const root = process.cwd();
const configPath = join(root, '.governance', 'change-safety.json');
const migrationRepairLockPath = join(root, '.governance', 'migration-repair-lock.json');
const errors: string[] = [];

if (!existsSync(configPath)) {
  console.error('Change safety failed: .governance/change-safety.json is required.');
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, 'utf8')) as SafetyConfig;
const migrationRepairLock = loadMigrationRepairLock();
const base = resolveBase();
const entries = readDiff(base);
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
  if (
    entry.path === '.governance/migration-repair-lock.json' &&
    Boolean(show(base, entry.path))
  ) {
    errors.push(
      '.governance/migration-repair-lock.json: the one-time migration repair lock is immutable once introduced.',
    );
  }

  const paths = [entry.oldPath, entry.path].filter(Boolean) as string[];
  for (const path of paths) {
    if (config.generatedOrForbiddenPaths.some((pattern) => matches(pattern, path))) {
      errors.push(`${path}: generated/forbidden artifact must not be committed.`);
    }
  }

  const migrationPaths = paths.filter((path) => path.startsWith('prisma/migrations/'));
  if (migrationPaths.length > 0 && !entry.status.startsWith('A')) {
    const explicitlyApprovedUnacceptedRepair =
      entry.status === 'M' &&
      manifest?.type === 'bugfix' &&
      Boolean(manifest.unacceptedMigrationRepairReason?.trim()) &&
      migrationPaths.every(
        (path) => manifest.unacceptedMigrationRepairs?.includes(path) && isLockedMigrationRepair(base, path),
      );

    const explicitlyApprovedIdentifierRepair =
      entry.status === 'M' &&
      manifest?.type === 'bugfix' &&
      migrationPaths.length === 1 &&
      isLockedMigrationRepair(base, entry.path) &&
      isApprovedHistoricalIdentifierRepair(base, entry.path, manifest);

    if (!explicitlyApprovedUnacceptedRepair && !explicitlyApprovedIdentifierRepair) {
      errors.push(
        `${paths.join(' -> ')}: accepted historical migrations are immutable; add a new migration instead.`,
      );
    }
  }
}

if (manifest) {
  checkTestEvidence(entries, manifest);

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
  if (value.testEvidence !== undefined && !Array.isArray(value.testEvidence)) {
    errors.push('change manifest: testEvidence must be an array when provided.');
  }
  for (const evidence of value.testEvidence ?? []) {
    if (typeof evidence !== 'string' || !evidence.trim()) {
      errors.push('change manifest: testEvidence entries must be non-empty paths.');
    }
  }
  if (value.allowBreakingPublicApi && !value.publicApiBreakingReason?.trim()) {
    errors.push(
      'change manifest: publicApiBreakingReason is required when allowBreakingPublicApi is true.',
    );
  }
  if (
    value.unacceptedMigrationRepairs !== undefined &&
    !Array.isArray(value.unacceptedMigrationRepairs)
  ) {
    errors.push('change manifest: unacceptedMigrationRepairs must be an array when provided.');
  }
  if (value.unacceptedMigrationRepairs?.length) {
    if (value.type !== 'bugfix') {
      errors.push('change manifest: unaccepted migration repair is allowed only for bugfix scope.');
    }
    if (!value.unacceptedMigrationRepairReason?.trim()) {
      errors.push(
        'change manifest: unacceptedMigrationRepairReason is required for migration repair.',
      );
    }
    for (const path of value.unacceptedMigrationRepairs) {
      if (!path.startsWith('prisma/migrations/')) {
        errors.push(
          `change manifest: unaccepted migration repair path must be under prisma/migrations/: ${path}.`,
        );
      }
    }
  }

  for (const repair of value.historicalMigrationIdentifierRepairs ?? []) {
    if (value.type !== 'bugfix') {
      errors.push(
        'change manifest: historical migration identifier repair is allowed only for bugfix scope.',
      );
    }
    if (!repair.path.startsWith('prisma/migrations/') || !repair.path.endsWith('/migration.sql')) {
      errors.push(
        `change manifest: historical identifier repair path is invalid: ${repair.path}.`,
      );
    }
    if (!repair.reason?.trim()) {
      errors.push(
        `change manifest: historical identifier repair reason is required for ${repair.path}.`,
      );
    }
    if (!Array.isArray(repair.renames) || repair.renames.length === 0) {
      errors.push(
        `change manifest: historical identifier repair requires explicit renames for ${repair.path}.`,
      );
    }
    for (const rename of repair.renames ?? []) {
      if (!rename.from?.trim() || !rename.to?.trim() || rename.from === rename.to) {
        errors.push(
          `change manifest: historical identifier repair rename is invalid for ${repair.path}.`,
        );
      }
      if (Buffer.byteLength(rename.to ?? '', 'utf8') > 63) {
        errors.push(
          `change manifest: repaired PostgreSQL identifier exceeds 63 bytes: ${rename.to}.`,
        );
      }
    }
  }
}

function loadMigrationRepairLock(): MigrationRepairLock {
  if (!existsSync(migrationRepairLockPath)) {
    errors.push('.governance/migration-repair-lock.json is required.');
    return { version: 1, repairs: [] };
  }

  try {
    const lock = JSON.parse(readFileSync(migrationRepairLockPath, 'utf8')) as MigrationRepairLock;
    if (lock.version !== 1 || !Array.isArray(lock.repairs)) {
      errors.push('.governance/migration-repair-lock.json: invalid lock format.');
      return { version: 1, repairs: [] };
    }
    for (const repair of lock.repairs) {
      if (
        !repair.path?.startsWith('prisma/migrations/') ||
        !repair.baseBlobSha?.trim() ||
        !repair.repairedBlobSha?.trim() ||
        !repair.reason?.trim()
      ) {
        errors.push('.governance/migration-repair-lock.json: every repair requires path, exact before/after blobs, and reason.');
      }
    }
    return lock;
  } catch (error) {
    errors.push(
      '.governance/migration-repair-lock.json: invalid JSON (' + String(error) + ').',
    );
    return { version: 1, repairs: [] };
  }
}

function isLockedMigrationRepair(baseSha: string, path: string): boolean {
  const lock = migrationRepairLock.repairs.find((item) => item.path === path);
  if (!lock) return false;

  try {
    const beforeBlob = git(['rev-parse', baseSha + ':' + path]).trim();
    const afterBlob = git(['hash-object', path]).trim();
    return beforeBlob === lock.baseBlobSha && afterBlob === lock.repairedBlobSha;
  } catch {
    return false;
  }
}

function checkTestEvidence(diffEntries: DiffEntry[], scope: ChangeManifest): void {
  if (scope.type === 'governance' || scope.type === 'architecture') return;

  const behaviorChanged = diffEntries.some(
    (entry) =>
      entry.status !== 'D' &&
      isBehaviorSource(entry.path) &&
      !isTestPath(entry.path),
  );
  if (!behaviorChanged) return;

  if (!scope.testEvidence?.length) {
    errors.push(
      'change manifest: behavioral source changes require changed automated testEvidence.',
    );
    return;
  }

  const changedPaths = new Set(
    diffEntries.filter((entry) => entry.status !== 'D').map((entry) => entry.path),
  );
  for (const path of scope.testEvidence) {
    if (!isTestPath(path)) {
      errors.push('change manifest: testEvidence must reference a test file: ' + path + '.');
      continue;
    }
    if (!changedPaths.has(path)) {
      errors.push('change manifest: testEvidence must be changed in the same scope: ' + path + '.');
    }
    if (!existsSync(join(root, path))) {
      errors.push('change manifest: testEvidence path does not exist: ' + path + '.');
    }
  }
}

function isBehaviorSource(path: string): boolean {
  return (
    /^(?:apps\/(?:api|web|owner)\/src\/|modules\/|packages\/).+\.(?:[cm]?[jt]sx?)$/.test(path)
  );
}

function isTestPath(path: string): boolean {
  return (
    /(?:^|\/)(?:__tests__|tests?|spec)(?:\/|$)/.test(path) ||
    /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(path)
  );
}

function isApprovedHistoricalIdentifierRepair(
  baseSha: string,
  path: string,
  scope: ChangeManifest,
): boolean {
  const repair = scope.historicalMigrationIdentifierRepairs?.find((item) => item.path === path);
  if (!repair || !repair.reason.trim() || repair.renames.length === 0) return false;

  const before = show(baseSha, path);
  const afterPath = join(root, path);
  if (!before || !existsSync(afterPath)) return false;

  let expected = before;
  for (const rename of repair.renames) {
    if (!rename.from || !rename.to || !expected.includes(rename.from)) return false;
    expected = expected.split(rename.from).join(rename.to);
  }

  return expected === readFileSync(afterPath, 'utf8');
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
  const escaped = [...pattern]
    .map((character) =>
      '.+^$(){}|[]\\\\'.includes(character) ? '\\' + character : character,
    )
    .join('');
  const regex = escaped
    .replace(/\*\*/g, '§DOUBLESTAR§')
    .replace(/\*/g, '[^/]*')
    .replace(/§DOUBLESTAR§/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${regex}$`).test(path);
}
