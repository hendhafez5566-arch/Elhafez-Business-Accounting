import { readFile } from 'node:fs/promises';
import type { MigrationConfig } from '@elhafez/platform-core';
import { AC14_CANONICAL_TARGET_BASELINE_SHA } from '@elhafez/platform-core';
import type { Ac14MigrationCoordinator } from './coordinator.service.js';

type Command = 'dry-run' | 'execute' | 'resume' | 'status' | 'verify';

const flag = (args: readonly string[], name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

/** Non-HTTP command entry. The process bootstrap supplies the composed coordinator. */
export async function runAc14Cli(coordinator: Ac14MigrationCoordinator, args: readonly string[]) {
  const command = args[0] as Command | undefined;
  if (!command || !['dry-run', 'execute', 'resume', 'status', 'verify'].includes(command)) throw new Error('command must be dry-run, execute, resume, status, or verify');
  const runId = flag(args, 'run-id');
  if (command === 'status') {
    if (!runId) throw new Error('--run-id is required for status');
    return coordinator.status(runId);
  }
  const snapshotPath = flag(args, 'snapshot');
  const configPath = flag(args, 'config');
  if (!snapshotPath || !configPath) throw new Error('--snapshot and --config are required');
  const parsed = JSON.parse(await readFile(configPath, 'utf8')) as MigrationConfig;
  const config = { ...parsed, ...(runId ? { runId } : {}) };
  const mode = command === 'dry-run' ? 'DRY_RUN' : command === 'resume' ? 'RESUME' : command === 'verify' ? 'VERIFY' : 'EXECUTE';
  return coordinator.run({ snapshotPath, targetBaselineSha: AC14_CANONICAL_TARGET_BASELINE_SHA, implementationVersion: 'AC-14', config, mode });
}
