import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { readJsonArray, writeJsonArrayAtomic } from '../jsonFileStore';

const tempDirs: string[] = [];

function makeTempFilePath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-persistence-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('readJsonArray', () => {
  it('returns an empty array when the file does not exist', () => {
    const filePath = makeTempFilePath('missing.json');
    expect(readJsonArray(filePath)).toEqual([]);
  });

  it('reads back exactly what was written', () => {
    const filePath = makeTempFilePath('data.json');
    const items = [{ id: '1', name: 'a' }, { id: '2', name: 'b' }];
    writeJsonArrayAtomic(filePath, items);
    expect(readJsonArray(filePath)).toEqual(items);
  });

  it('propagates non-ENOENT errors (e.g. malformed JSON) rather than silently returning empty', () => {
    const filePath = makeTempFilePath('malformed.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{ not valid json', 'utf-8');
    expect(() => readJsonArray(filePath)).toThrow();
  });
});

describe('writeJsonArrayAtomic', () => {
  it('creates the containing directory if it does not exist yet', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-persistence-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'nested', 'deeper', 'data.json');
    writeJsonArrayAtomic(filePath, [{ id: '1' }]);
    expect(readJsonArray(filePath)).toEqual([{ id: '1' }]);
  });

  it('leaves no leftover temp files after a successful write', () => {
    const filePath = makeTempFilePath('data.json');
    writeJsonArrayAtomic(filePath, [{ id: '1' }]);
    const entries = fs.readdirSync(path.dirname(filePath));
    expect(entries).toEqual(['data.json']);
  });

  it('overwrites previous contents rather than appending', () => {
    const filePath = makeTempFilePath('data.json');
    writeJsonArrayAtomic(filePath, [{ id: '1' }]);
    writeJsonArrayAtomic(filePath, [{ id: '2' }]);
    expect(readJsonArray(filePath)).toEqual([{ id: '2' }]);
  });

  it('simulates a restart: a second independent read after a write sees the persisted data', () => {
    const filePath = makeTempFilePath('data.json');
    writeJsonArrayAtomic(filePath, [{ id: '1' }, { id: '2' }]);
    // A fresh read call with no shared in-memory state, as a newly-constructed
    // repository would perform on server startup.
    const reloaded = readJsonArray(filePath);
    expect(reloaded).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
