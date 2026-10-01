import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const orchestratorPath = join(
  root,
  'modules',
  'tourism-finance-orchestration',
  'src',
  'application',
  'tourism-finance-orchestration.application-service.ts',
);
const source = readFileSync(orchestratorPath, 'utf8');
const constructorMatch = /constructor\s*\(([^)]*)\)\s*\{/s.exec(source);

if (!constructorMatch) {
  console.error('Tourism finance orchestrator budget failed: constructor not found.');
  process.exit(1);
}

const directDependencyCount = [...constructorMatch[1]!.matchAll(/\bprivate\s+readonly\b/g)].length;
const maxDirectDependencies = 9;

if (directDependencyCount > maxDirectDependencies) {
  console.error(
    [
      'Tourism finance orchestrator budget failed:',
      `- direct dependencies grew from the approved ceiling of ${maxDirectDependencies} to ${directDependencyCount}.`,
      '- extract the new workflow/use case into a focused application service and keep this class as an orchestrator.',
      '- do not raise this ceiling to bypass the guard.',
    ].join('\n'),
  );
  process.exit(1);
}

const forbiddenInfrastructureImports = [
  ...source.matchAll(/from\s+['"]([^'"]*\/infrastructure\/[^'"]*)['"]/g),
].map((match) => match[1]!);

if (forbiddenInfrastructureImports.length) {
  console.error(
    [
      'Tourism finance orchestrator boundary check failed:',
      ...forbiddenInfrastructureImports.map(
        (value) => `- application orchestration must not import infrastructure directly: ${value}`,
      ),
    ].join('\n'),
  );
  process.exit(1);
}

console.log(
  `Tourism finance orchestrator budget passed (${directDependencyCount}/${maxDirectDependencies} direct dependencies; no infrastructure imports).`,
);
