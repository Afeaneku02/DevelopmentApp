import { describe, expect, it } from 'vitest';
import { findViolations, PRIVACY_CHECKS } from '../privacyCheckRules.mjs';

function flaggedIds(path) {
  return findViolations([path]).map((v) => v.id);
}

describe('privacyCheckRules', () => {
  describe('docs/', () => {
    it('flags any path under docs/', () => {
      expect(flaggedIds('docs/architecture-decisions/0001-x.md')).toContain('docs');
      expect(flaggedIds('docs/development-journal/DEVELOPMENT_INDEX.md')).toContain('docs');
      expect(flaggedIds('docs/a/b/c/d.md')).toContain('docs');
    });

    it('does not flag a path that merely contains "docs" elsewhere', () => {
      expect(flaggedIds('services/roadmap/docs-helper.ts')).not.toContain('docs');
      expect(flaggedIds('mydocs/readme.md')).not.toContain('docs');
    });
  });

  describe('*.docx', () => {
    it('flags .docx files anywhere, case-insensitively', () => {
      expect(flaggedIds('Better_You_Product_Vision.docx')).toContain('docx');
      expect(flaggedIds('nested/dir/Notes.DOCX')).toContain('docx');
    });

    it('does not flag other extensions', () => {
      expect(flaggedIds('README.md')).not.toContain('docx');
      expect(flaggedIds('notes.doc')).not.toContain('docx'); // .doc, not .docx
    });
  });

  describe('.env files', () => {
    it('flags .env and .env.<anything>', () => {
      expect(flaggedIds('.env')).toContain('env');
      expect(flaggedIds('.env.local')).toContain('env');
      expect(flaggedIds('Apps/api/.env')).toContain('env');
    });

    it('does not flag .env.example at any depth - the one deliberate exception', () => {
      expect(flaggedIds('.env.example')).not.toContain('env');
      expect(flaggedIds('Apps/web/.env.example')).not.toContain('env');
    });

    it('does not flag unrelated files', () => {
      expect(flaggedIds('environment.ts')).not.toContain('env');
      expect(flaggedIds('services/config/env.ts')).not.toContain('env');
    });
  });

  describe('database files', () => {
    it('flags .sqlite, .sqlite3, and .db files', () => {
      expect(flaggedIds('local.sqlite')).toContain('database');
      expect(flaggedIds('Apps/api/data/app.sqlite3')).toContain('database');
      expect(flaggedIds('dump.db')).toContain('database');
    });

    it('does not flag unrelated files', () => {
      expect(flaggedIds('services/roadmap/src/roadmapService.ts')).not.toContain('database');
    });
  });

  describe('keys and certificates', () => {
    it('flags .pem, .key, .p12, and .pfx files', () => {
      expect(flaggedIds('server.pem')).toContain('keyOrCert');
      expect(flaggedIds('private.key')).toContain('keyOrCert');
      expect(flaggedIds('cert.p12')).toContain('keyOrCert');
      expect(flaggedIds('cert.pfx')).toContain('keyOrCert');
    });

    it('does not flag unrelated files', () => {
      expect(flaggedIds('services/roadmap/src/roadmapGenerationInput.ts')).not.toContain('keyOrCert');
    });
  });

  describe('Apps/api/data/', () => {
    it('flags the local data directory and anything inside it', () => {
      expect(flaggedIds('Apps/api/data')).toContain('localDataDir');
      expect(flaggedIds('Apps/api/data/goals.json')).toContain('localDataDir');
    });

    it('does not flag other Apps/api paths', () => {
      expect(flaggedIds('Apps/api/src/server.ts')).not.toContain('localDataDir');
      expect(flaggedIds('Apps/api/database-schema-notes.ts')).not.toContain('localDataDir');
    });
  });

  it('does not flag ordinary source/test files anywhere in the project (no false positives)', () => {
    const realFiles = [
      'package.json',
      'tsconfig.json',
      'README.md',
      'services/roadmap/src/roadmapService.ts',
      'services/roadmap/src/__tests__/roadmapService.test.ts',
      'Apps/web/src/screens/DashboardScreen.tsx',
      'Apps/api/src/server.ts',
      'tests/integration/api.integration.test.ts',
      '.gitignore',
      '.env.example',
      'Apps/web/.env.example',
    ];
    expect(findViolations(realFiles)).toEqual([]);
  });

  it('exposes exactly the documented check categories', () => {
    expect(PRIVACY_CHECKS.map((c) => c.id).sort()).toEqual(
      ['database', 'docs', 'docx', 'env', 'keyOrCert', 'localDataDir'].sort()
    );
  });

  it('reports one violation entry per matching check when a path matches more than one', () => {
    // A contrived path matching two checks at once - proves findViolations
    // doesn't stop at the first match.
    const violations = findViolations(['docs/secret.docx']);
    expect(violations.map((v) => v.id).sort()).toEqual(['docs', 'docx']);
  });
});
