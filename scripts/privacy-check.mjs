// Repeatable pre-push privacy/release check (see CLAUDE.md §5 and the
// docs/*.docx local-only policy established across several ADRs). Fails
// (non-zero exit) if:
//   1. any forbidden path (docs/, *.docx, .env*, database files, private
//      keys/certs, the local data directory) is tracked in git right now -
//      this covers both something already committed in the past and
//      something newly `git add`-ed for the next commit, since both live in
//      the index;
//   2. any forbidden path exists on disk, is untracked, and is NOT covered
//      by .gitignore - i.e. a future `git add -A` could sweep it in without
//      anyone noticing;
//   3. .gitignore no longer actually covers the known-sensitive path
//      patterns (docs/, *.docx, .env, the local data directory) - catches
//      someone accidentally editing .gitignore and silently reopening the
//      hole this check exists to close.
//
// Run via `npm run privacy:check` (and as part of `npm run verify`).
// Resolves the repo root via `git rev-parse --show-toplevel` from the
// current working directory - not the script's own file location - so this
// script can be pointed at any git repository (including a disposable
// fixture) for testing; see scripts/__tests__/privacyCheck.integration.test.mjs.

import { execFileSync } from 'node:child_process';
import { findViolations } from './privacyCheckRules.mjs';

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf-8', ...options });
}

function isIgnored(repoRoot, relativePath) {
  try {
    git(['check-ignore', '-q', relativePath], { cwd: repoRoot, stdio: 'ignore' });
    return true;
  } catch (err) {
    if (err.status === 1) return false; // not ignored - not an error
    throw err; // e.g. status 128: not a git repo at all - a real problem
  }
}

function main() {
  let repoRoot;
  try {
    repoRoot = git(['rev-parse', '--show-toplevel']).trim();
  } catch {
    console.error('privacy:check: not inside a git repository.');
    process.exit(1);
  }

  const failures = [];

  // 1. Tracked/staged files.
  const trackedFiles = git(['ls-files'], { cwd: repoRoot })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const trackedViolations = findViolations(trackedFiles);
  if (trackedViolations.length > 0) {
    failures.push({
      heading: 'Forbidden paths are tracked/staged in git:',
      lines: trackedViolations.map((v) => `  - ${v.path}  [${v.label}]`),
    });
  }

  // 2. Untracked files on disk that aren't covered by .gitignore - the next
  // `git add -A` would pick these up.
  const statusLines = git(['status', '--porcelain', '--ignored=no'], { cwd: repoRoot })
    .split('\n')
    .filter((line) => line.startsWith('?? '));
  const untrackedFiles = statusLines.map((line) => line.slice(3).trim());
  const untrackedViolations = findViolations(untrackedFiles);
  if (untrackedViolations.length > 0) {
    failures.push({
      heading: "Forbidden paths exist on disk, are untracked, and aren't covered by .gitignore (a future `git add` could commit them):",
      lines: untrackedViolations.map((v) => `  - ${v.path}  [${v.label}]`),
    });
  }

  // 3. .gitignore coverage - probe representative paths for the categories
  // that must always stay ignored regardless of whether any real file at
  // that exact path exists right now.
  const probes = [
    { path: 'docs/PRIVACY_CHECK_PROBE.md', label: 'docs/' },
    { path: 'PRIVACY_CHECK_PROBE.docx', label: '*.docx' },
    { path: '.env', label: '.env' },
    { path: 'Apps/api/data/PRIVACY_CHECK_PROBE.json', label: 'Apps/api/data/' },
  ];
  const uncoveredProbes = probes.filter((probe) => !isIgnored(repoRoot, probe.path));
  if (uncoveredProbes.length > 0) {
    failures.push({
      heading: '.gitignore no longer covers these required patterns:',
      lines: uncoveredProbes.map((p) => `  - ${p.path}  [expected pattern: ${p.label}]`),
    });
  }

  if (failures.length > 0) {
    console.error('privacy:check FAILED\n');
    for (const failure of failures) {
      console.error(failure.heading);
      console.error(failure.lines.join('\n'));
      console.error('');
    }
    console.error('See CLAUDE.md §5: never commit secrets, private docs, or local-only data.');
    process.exit(1);
  }

  console.log('privacy:check passed - no docs/, *.docx, .env, database, key/cert, or local data-directory files are tracked, staged, or exposed by a gitignore gap.');
}

main();
