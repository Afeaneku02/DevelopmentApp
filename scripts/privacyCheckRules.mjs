// Pure, git-independent matching rules for scripts/privacy-check.mjs -
// separated out specifically so this logic can be unit tested directly
// (see scripts/__tests__/privacyCheckRules.test.mjs) without needing a git
// repository at all. Every predicate takes a path using forward slashes,
// relative to the repo root (matching `git ls-files`/`git status` output).

function basename(path) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

function isDocsPath(path) {
  return path === 'docs' || path.startsWith('docs/');
}

function isDocxFile(path) {
  return /\.docx$/i.test(path);
}

// .env and .env.<anything> are forbidden, but .env.example (at any depth,
// e.g. Apps/web/.env.example) is the one deliberate exception - it's meant
// to be tracked (see RUNNING.md / apps/*/README.md).
function isEnvFile(path) {
  const base = basename(path);
  if (base === '.env.example' || base.endsWith('.env.example')) return false;
  return base === '.env' || /^\.env\.[^./]+$/.test(base);
}

function isDatabaseFile(path) {
  return /\.(sqlite3?|db)$/i.test(path);
}

function isKeyOrCertFile(path) {
  return /\.(pem|key|p12|pfx)$/i.test(path);
}

// The one known local-only data directory this project actually has (ADR
// 0016) - already gitignored, but checked explicitly too in case that rule
// is ever accidentally removed.
function isLocalDataDir(path) {
  return path === 'Apps/api/data' || path.startsWith('Apps/api/data/');
}

// Each check pairs a human-readable label (shown in the script's output)
// with a predicate. Order doesn't matter - a path can match more than one
// and every match is reported.
export const PRIVACY_CHECKS = [
  { id: 'docs', label: 'docs/ (private local journal & ADRs - see CLAUDE.md)', test: isDocsPath },
  { id: 'docx', label: '*.docx (private local documents)', test: isDocxFile },
  { id: 'env', label: '.env / .env.* (local secrets - not .env.example)', test: isEnvFile },
  { id: 'database', label: '*.sqlite / *.sqlite3 / *.db (local database files)', test: isDatabaseFile },
  { id: 'keyOrCert', label: '*.pem / *.key / *.p12 / *.pfx (private keys or certificates)', test: isKeyOrCertFile },
  { id: 'localDataDir', label: 'Apps/api/data/ (local durable app data - ADR 0016)', test: isLocalDataDir },
];

// Runs every path through every check and returns one entry per match
// (a single path can appear more than once if it matches multiple checks).
export function findViolations(paths) {
  const violations = [];
  for (const path of paths) {
    for (const check of PRIVACY_CHECKS) {
      if (check.test(path)) {
        violations.push({ path, id: check.id, label: check.label });
      }
    }
  }
  return violations;
}
