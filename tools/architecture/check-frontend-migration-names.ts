import { existsSync, readdirSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

const root = process.cwd();
const webSourceRoot = join(root, 'apps', 'web', 'src');
const transitionalPrefixes = ['advanced-', 'parity-', 'corrective-', 'legacy-'] as const;

// Baseline only: these files pre-date this guard and must be folded into canonical owners over time.
// Do not add new entries here as a shortcut. New frontend work should use canonical, domain-oriented names.
// This guard protects canonical ownership naming only. It must never freeze tabs, sidebars, navigation,
// DOM structure, screen layout, visual hierarchy, theme, or any other intentional UI/UX redesign.
const allowedBaseline = new Set([
  'apps/web/src/advanced-accounting-client.ts',
  'apps/web/src/advanced-accounting-corrective-sections.tsx',
  'apps/web/src/advanced-accounting-parity-sections.tsx',
  'apps/web/src/advanced-accounting-sections.tsx',
]);

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const violations = sourceFiles(webSourceRoot)
  .map((file) => ({
    file,
    relativePath: relative(root, file).split(sep).join('/'),
  }))
  .filter(({ file, relativePath }) => {
    const fileName = basename(file);
    return (
      transitionalPrefixes.some((prefix) => fileName.startsWith(prefix)) &&
      !allowedBaseline.has(relativePath)
    );
  })
  .map(({ relativePath }) => relativePath);

if (violations.length) {
  console.error(
    [
      'Frontend migration naming check failed:',
      ...violations.map(
        (file) =>
          `- ${file}: new advanced-/parity-/corrective-/legacy- owners are forbidden; extend or create a canonical domain owner instead.`,
      ),
    ].join('\n'),
  );
  process.exit(1);
}

console.log(
  `Frontend migration naming check passed (${allowedBaseline.size} grandfathered files; no new transitional owners).`,
);
