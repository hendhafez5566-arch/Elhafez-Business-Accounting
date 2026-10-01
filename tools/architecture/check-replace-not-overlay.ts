import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const webRoot = join(root, 'apps', 'web', 'src');
const pagesRoot = join(webRoot, 'pages');
const routeSurfacePath = join(webRoot, 'route-surface.ts');
const appShellPath = join(webRoot, 'app-shell.tsx');
const errors: string[] = [];

function filesIn(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

const routeSurfaceSource = existsSync(routeSurfacePath)
  ? readFileSync(routeSurfacePath, 'utf8')
  : '';
const fullBleedOwners = new Set(
  [...routeSurfaceSource.matchAll(/['"]([^'"]+)['"]\s*:\s*['"]full-bleed['"]/g)]
    .map((match) => match[1]!),
);

if (!routeSurfaceSource) {
  errors.push('apps/web/src/route-surface.ts: explicit route-surface ownership is required.');
}

const appShellSource = existsSync(appShellPath) ? readFileSync(appShellPath, 'utf8') : '';
if (!appShellSource.includes("surface === 'full-bleed'")) {
  errors.push('apps/web/src/app-shell.tsx: full-bleed routes must be selected before the standard shell renders.');
}
if (!appShellSource.includes('<RoutePresentationBoundary mode="route-owned">')) {
  errors.push('apps/web/src/app-shell.tsx: full-bleed routes must use the route-owned presentation boundary.');
}

for (const file of filesIn(pagesRoot).filter((path) => path.endsWith('.css'))) {
  const from = relative(root, file).split(sep).join('/');
  const segments = from.split('/');
  const owner = segments[4];
  const content = readFileSync(file, 'utf8');

  if (!owner) {
    errors.push(`${from}: route-owned stylesheet has no route owner.`);
    continue;
  }
  if (!content.includes(`page-style-owner: ${owner}`)) {
    errors.push(`${from}: route-owned stylesheet must declare /* page-style-owner: ${owner} */.`);
  }
  if (!fullBleedOwners.has(owner)) {
    errors.push(`${from}: route-owned CSS is allowed only for a route explicitly declared full-bleed in route-surface.ts.`);
  }
  if (/!important\b/.test(content)) {
    errors.push(`${from}: !important is forbidden in route-owned page CSS; replace the old presentation instead of overpowering it.`);
  }
  if (content.includes(':has(')) {
    errors.push(`${from}: :has() may not be used to detect or hide already-rendered UI layers.`);
  }
  if (/(?:^|[,{]\s*)(?:html\b|body\b|:root\b|\.app-shell\b|\.app-sidebar\b|\.app-topbar\b|\.app-main\b|\.app-content\b|\.app-route-surface\b|\.ui-page-stack\b)/m.test(content)) {
    errors.push(`${from}: route-owned CSS may not control the document, shell, navigation, or canonical page stack.`);
  }
  if (/\b(?:legacy|backup|copy|final|new|v\d+)\b/i.test(segments.at(-1) ?? '')) {
    errors.push(`${from}: versioned/legacy replacement filenames are forbidden; keep one active presentation owner per route.`);
  }
}

if (errors.length) {
  console.error('Replace-not-overlay guard failed:\n' + errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Replace-not-overlay guard passed (${fullBleedOwners.size} explicit full-bleed route owner${fullBleedOwners.size === 1 ? '' : 's'}).`);
