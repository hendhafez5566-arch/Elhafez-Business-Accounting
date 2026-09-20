import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRawSnapshot, sha256OfRawBytes, SnapshotFormatError } from './snapshot-reader.js';

async function withTempFile(contents: string, run: (path: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'ac14a-snapshot-'));
  const path = join(dir, 'snapshot.json');
  try {
    await writeFile(path, contents, 'utf8');
    await run(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('raw snapshot SHA-256 is stable and computed over the raw bytes before parsing', async () => {
  await withTempFile('{"a":1}', async (path) => {
    const first = await readRawSnapshot(path);
    const second = await readRawSnapshot(path);
    assert.equal(first.sha256, second.sha256);
    assert.equal(first.sha256, sha256OfRawBytes(Buffer.from('{"a":1}', 'utf8')));
  });
});

test('a structurally different but semantically equal-looking file hashes differently', async () => {
  await withTempFile('{"a": 1}', async (pathWithSpace) => {
    const withSpace = await readRawSnapshot(pathWithSpace);
    await withTempFile('{"a":1}', async (pathNoSpace) => {
      const noSpace = await readRawSnapshot(pathNoSpace);
      assert.notEqual(withSpace.sha256, noSpace.sha256);
    });
  });
});

test('malformed JSON is rejected', async () => {
  await withTempFile('{not valid json', async (path) => {
    await assert.rejects(readRawSnapshot(path), SnapshotFormatError);
  });
});

test('a non-object root (array, string, number) is rejected', async () => {
  await withTempFile('[1,2,3]', async (path) => {
    await assert.rejects(readRawSnapshot(path), SnapshotFormatError);
  });
  await withTempFile('"just a string"', async (path) => {
    await assert.rejects(readRawSnapshot(path), SnapshotFormatError);
  });
});

test('a valid object root exposes its top-level collection keys, sorted, with no interpretation of their contents', async () => {
  await withTempFile('{"journals": [], "accounts": [1,2], "zz": null}', async (path) => {
    const snapshot = await readRawSnapshot(path);
    assert.deepEqual(snapshot.collectionKeys, ['accounts', 'journals', 'zz']);
  });
});
