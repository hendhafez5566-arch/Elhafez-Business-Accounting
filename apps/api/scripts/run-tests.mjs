import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

function specs(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...specs(path));
    else if (entry.isFile() && entry.name.endsWith('.spec.ts')) files.push(path);
  }
  return files;
}

const files = specs(resolve('src')).sort();
if (!files.length) {
  console.error('No API test files found.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...files],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: resolve('tsconfig.json'),
    },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
