// Deletes apps/api's durable data directory (ADR 0016's File*Repository JSON
// files) so the next `npm run dev:api` / `npm run start -w apps/api` starts
// from a clean slate - no accounts, goals, check-ins, etc.
//
// Run via `npm run reset-data` (loads .env first, so a custom DATA_DIR is
// respected). Stop apps/api before running this - the file-backed
// repositories load once at startup and rewrite the whole file per mutation,
// so deleting out from under a running process and then writing to it again
// would recreate a directory the process never reloads from.

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const apiDir = join(repoRoot, 'Apps', 'api');

const dataDirSetting = process.env.DATA_DIR && process.env.DATA_DIR.trim().length > 0
  ? process.env.DATA_DIR
  : './data';

// DATA_DIR resolves relative to apps/api's own working directory at runtime
// (see Apps/api/src/index.ts), so mirror that here rather than resolving
// against the repo root.
const dataDir = isAbsolute(dataDirSetting) ? dataDirSetting : resolve(apiDir, dataDirSetting);

// Refuse to delete anything that isn't clearly a data directory nested
// inside the repo - guards against a misconfigured DATA_DIR (e.g. '.' or
// '..') turning this into an accidental `rm -rf` of something unintended.
if (dataDir === repoRoot || dataDir === apiDir || !dataDir.startsWith(repoRoot)) {
  console.error(`Refusing to delete "${dataDir}" - it isn't a data directory nested inside the repo.`);
  console.error('Check your DATA_DIR setting in .env.');
  process.exit(1);
}

if (!existsSync(dataDir)) {
  console.log(`Nothing to reset - "${dataDir}" doesn't exist yet.`);
  process.exit(0);
}

const files = readdirSync(dataDir);
rmSync(dataDir, { recursive: true, force: true });

console.log(`Deleted "${dataDir}"${files.length > 0 ? ` (${files.length} file(s): ${files.join(', ')})` : ' (was empty)'}.`);
console.log('apps/api will recreate it on next startup. All local accounts, goals, and other data are gone.');
