import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export class SnapshotFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotFormatError';
  }
}

export interface RawSnapshot {
  /** SHA-256 hex digest of the raw file bytes, computed BEFORE any JSON parsing. */
  sha256: string;
  /** The parsed root. AC-14A only proves it is structurally an object — it does not migrate collections. */
  root: Record<string, unknown>;
  /** Top-level keys present in the snapshot root, for preflight visibility only. */
  collectionKeys: readonly string[];
}

/**
 * Reads a raw exported legacy snapshot file, hashes the RAW bytes first
 * (per AC-14 rule: hash before parsing), then validates only that the
 * parsed root is a JSON object. AC-14A does not interpret or migrate any
 * collection inside it.
 */
export async function readRawSnapshot(path: string): Promise<RawSnapshot> {
  const bytes = await readFile(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new SnapshotFormatError('snapshot file is not valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SnapshotFormatError('snapshot root must be a JSON object');
  }

  const root = parsed as Record<string, unknown>;
  return { sha256, root, collectionKeys: Object.keys(root).sort() };
}

/** Hashes raw bytes directly, for callers that already have the buffer (e.g. tests). */
export function sha256OfRawBytes(bytes: Buffer | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
