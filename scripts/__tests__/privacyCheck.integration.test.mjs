import { describe, expect, it, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercises the real scripts/privacy-check.mjs end to end against a
// disposable, throwaway git repository - not this project's own repo - so
// these tests can freely create "bad" files without any risk of ever
// touching real docs/, secrets, or this repo's own git state. The script
// resolves its target repo via `git rev-parse --show-toplevel` from
// process.cwd(), so pointing execFileSync's `cwd` at the fixture directory
// is enough to redirect it there.

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'privacy-check.mjs');
const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeFixtureRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'privacy-check-fixture-'));
  tempDirs.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  writeFileSync(
    join(dir, '.gitignore'),
    'node_modules/\ndocs/\n*.docx\n.env\ndata/\n',
    'utf-8'
  );
  writeFileSync(join(dir, 'README.md'), '# Fixture\n', 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'initial commit'], { cwd: dir });
  return dir;
}

function runPrivacyCheck(cwd) {
  try {
    const stdout = execFileSync('node', [scriptPath], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

describe('privacy-check.mjs (integration, fixture repo)', () => {
  it('passes on a clean repo with a proper .gitignore and no forbidden files', () => {
    const dir = makeFixtureRepo();
    const result = runPrivacyCheck(dir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('privacy:check passed');
  });

  it('fails when a docs/ file is tracked', () => {
    const dir = makeFixtureRepo();
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'docs', 'notes.md'), 'private notes', 'utf-8');
    // Force-add despite .gitignore, simulating someone bypassing the ignore
    // rule directly (`git add -f`) - the exact scenario this check exists for.
    execFileSync('git', ['add', '-f', 'docs/notes.md'], { cwd: dir });

    const result = runPrivacyCheck(dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('docs/notes.md');
  });

  it('fails when a .docx file is untracked but not covered by .gitignore', () => {
    const dir = makeFixtureRepo();
    // Overwrite .gitignore to remove the *.docx rule, simulating the exact
    // "someone edited .gitignore" regression this check guards against.
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\ndocs/\n.env\ndata/\n', 'utf-8');
    writeFileSync(join(dir, 'Private_Plan.docx'), 'binary-ish content', 'utf-8');

    const result = runPrivacyCheck(dir);
    expect(result.code).toBe(1);
    // Both the untracked-and-uncovered file and the gitignore-coverage
    // probe for *.docx should be flagged.
    expect(result.stderr).toContain('Private_Plan.docx');
    expect(result.stderr).toContain('.gitignore no longer covers');
  });

  it('fails when .gitignore stops covering docs/, even with no docs/ file present at all', () => {
    const dir = makeFixtureRepo();
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n*.docx\n.env\ndata/\n', 'utf-8');

    const result = runPrivacyCheck(dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('.gitignore no longer covers');
    expect(result.stderr).toContain('docs/');
  });

  it('passes when a real .env.example is tracked (the deliberate exception)', () => {
    const dir = makeFixtureRepo();
    writeFileSync(join(dir, '.env.example'), 'API_PORT=4000\n', 'utf-8');
    execFileSync('git', ['add', '.env.example'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'add env example'], { cwd: dir });

    const result = runPrivacyCheck(dir);
    expect(result.code).toBe(0);
  });
});
