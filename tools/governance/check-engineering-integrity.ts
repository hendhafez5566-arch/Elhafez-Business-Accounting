import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

interface Constitution {
  readonly version: number;
  readonly mode: 'fail-closed';
  readonly requiredVerifySequence: string[];
  readonly requiredCiCommands: string[];
  readonly requiredProtectedPaths: string[];
}

interface ChangeSafetyConfig {
  readonly protectedPaths: string[];
}

const root = process.cwd();
const errors: string[] = [];
const constitutionPath = join(root, '.governance', 'architecture-constitution.json');
const changeSafetyPath = join(root, '.governance', 'change-safety.json');
const packagePath = join(root, 'package.json');
const ciPath = join(root, '.github', 'workflows', 'ci.yml');

for (const required of [constitutionPath, changeSafetyPath, packagePath, ciPath]) {
  if (!existsSync(required)) {
    errors.push(relative(root, required).split(sep).join('/') + ': required enforcement file is missing.');
  }
}

if (errors.length === 0) {
  const constitution = JSON.parse(readFileSync(constitutionPath, 'utf8')) as Constitution;
  const changeSafety = JSON.parse(readFileSync(changeSafetyPath, 'utf8')) as ChangeSafetyConfig;
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    readonly scripts?: Record<string, string>;
  };
  const ci = readFileSync(ciPath, 'utf8');

  if (constitution.version !== 1 || constitution.mode !== 'fail-closed') {
    errors.push('.governance/architecture-constitution.json: unsupported or non fail-closed constitution.');
  }

  const verify = packageJson.scripts?.verify ?? '';
  let cursor = -1;
  for (const command of constitution.requiredVerifySequence) {
    const index = verify.indexOf(command, cursor + 1);
    if (index === -1) {
      errors.push('package.json: verify must contain required gate in order: ' + command + '.');
    } else {
      cursor = index;
    }
  }

  if (packageJson.scripts?.['engineering-integrity:check'] !== 'tsx tools/governance/check-engineering-integrity.ts') {
    errors.push('package.json: engineering-integrity:check must point to the canonical checker.');
  }

  for (const command of constitution.requiredCiCommands) {
    if (!ci.includes(command)) {
      errors.push('.github/workflows/ci.yml: required CI command is missing: ' + command + '.');
    }
  }

  for (const path of constitution.requiredProtectedPaths) {
    if (!changeSafety.protectedPaths.includes(path)) {
      errors.push('.governance/change-safety.json: critical path is not protected: ' + path + '.');
    }
  }
}

const base = resolveBase();
const diff = git(['diff', '--unified=0', '--no-color', base + '...HEAD', '--']);
let currentPath = '';

for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) {
    const value = line.slice(4).trim();
    currentPath = value === '/dev/null' ? '' : value.replace(/^b\//, '');
    continue;
  }
  if (!currentPath || !line.startsWith('+') || line.startsWith('+++')) continue;

  const added = line.slice(1);
  const source = /\.(?:[cm]?[jt]sx?)$/.test(currentPath);
  const testFile = isTestFile(currentPath);
  const self = currentPath === 'tools/governance/check-engineering-integrity.ts';

  if (source && !self) {
    if (/@ts-(?:ignore|nocheck)\b/.test(added)) {
      errors.push(currentPath + ': TypeScript suppression is forbidden in added code.');
    }
    if (/eslint-disable(?:-next-line|-line)?\b/.test(added)) {
      errors.push(currentPath + ': ESLint suppression is forbidden in added code.');
    }
    if (/\bas\s+any\b/.test(added)) {
      errors.push(currentPath + ': unsafe "as any" cast is forbidden in added code.');
    }
    if (!testFile && /\bas\s+never\b/.test(added)) {
      errors.push(currentPath + ': unsafe production "as never" cast is forbidden in added code.');
    }
    if (/@ts-expect-error\b/.test(added)) {
      if (!testFile) {
        errors.push(currentPath + ': @ts-expect-error is forbidden in production code.');
      } else if (!/@ts-expect-error\s+\S.{8,}/.test(added)) {
        errors.push(currentPath + ': test-only @ts-expect-error requires an explicit reason.');
      }
    }
  }

  if (
    !self &&
    (
      currentPath === 'package.json' ||
      currentPath.startsWith('.github/workflows/') ||
      currentPath.startsWith('tools/')
    )
  ) {
    if (/continue-on-error\s*:\s*true/.test(added)) {
      errors.push(currentPath + ': continue-on-error is forbidden for quality/enforcement work.');
    }
    if (/\|\|\s*true(?:\s|$)/.test(added)) {
      errors.push(currentPath + ': hidden success fallback "|| true" is forbidden.');
    }
    if (/--no-verify\b/.test(added)) {
      errors.push(currentPath + ': --no-verify bypass is forbidden.');
    }
  }
}

for (const file of sourceFiles()) {
  if (!isTestFile(file)) continue;
  const content = readFileSync(join(root, file), 'utf8');
  if (/\b(?:describe|it|test)\.(?:skip|only)\s*\(/.test(content)) {
    errors.push(file + ': focused or skipped committed tests are forbidden.');
  }
  if (/\b(?:xdescribe|xit|xtest)\s*\(/.test(content)) {
    errors.push(file + ': disabled committed tests are forbidden.');
  }
}

if (errors.length) {
  console.error('Engineering integrity check failed:\n' + errors.map((error) => '- ' + error).join('\n'));
  process.exit(1);
}

console.log('Engineering integrity check passed (fail-closed constitution, anti-patching diff scan, CI self-check, and test-focus guard).');

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

function git(args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function isTestFile(path: string): boolean {
  return /(?:^|\/)(?:__tests__|tests?|spec)(?:\/|$)/.test(path) || /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(path);
}

function sourceFiles(): string[] {
  const roots = ['apps', 'modules', 'packages'];
  const result: string[] = [];
  for (const name of roots) {
    const absolute = join(root, name);
    if (!existsSync(absolute)) continue;
    walk(absolute, result);
  }
  return result;
}

function walk(directory: string, target: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, target);
      continue;
    }
    if (!/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) continue;
    target.push(relative(root, absolute).split(sep).join('/'));
  }
}
