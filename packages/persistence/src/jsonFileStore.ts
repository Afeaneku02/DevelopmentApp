import * as fs from 'node:fs';
import * as path from 'node:path';

// Missing file means "nothing persisted yet" (first run against a fresh
// data directory), not an error - every File*Repository starts empty in
// that case, same as the InMemory* repositories always did.
export function readJsonArray<T>(filePath: string): T[] {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

// Writes to a temp file in the same directory then renames over the target,
// so a crash or restart mid-write can never leave a truncated/corrupt file -
// the rename is atomic, the target either has the old complete contents or
// the new complete contents, never a partial write.
export function writeJsonArrayAtomic<T>(filePath: string, items: T[]): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, JSON.stringify(items, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}
