import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

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
  process.stderr.write('No API test files found.\n');
  process.exit(1);
}

const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));
const result = spawnSync(
  process.execPath,
  [
    tsxCli,
    '--tsconfig',
    resolve('tsconfig.json'),
    '--test',
    ...files,
  ],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
