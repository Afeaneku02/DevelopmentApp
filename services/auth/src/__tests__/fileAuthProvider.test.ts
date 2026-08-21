import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileAuthProvider } from '../fileAuthProvider';

const tempDirs: string[] = [];

function makeTempFilePath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-auth-provider-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('FileAuthProvider', () => {
  it('survives a simulated restart: a new instance can still verify credentials created by a previous one', async () => {
    const filePath = makeTempFilePath('auth-identities.json');
    const before = new FileAuthProvider(filePath);
    await before.createIdentity('jamie@example.com', 'correct-horse-battery');

    // A brand-new provider instance, as server startup would construct after
    // a restart - this is the core requirement: an account created before a
    // restart must still be able to log in after one.
    const after = new FileAuthProvider(filePath);
    const result = await after.verifyCredentials('jamie@example.com', 'correct-horse-battery');
    expect(result).not.toBeNull();

    const wrongPassword = await after.verifyCredentials('jamie@example.com', 'wrong-password');
    expect(wrongPassword).toBeNull();
  });

  it('persists deleteIdentity across a restart', async () => {
    const filePath = makeTempFilePath('auth-identities.json');
    const before = new FileAuthProvider(filePath);
    const { authSubject } = await before.createIdentity('jamie@example.com', 'correct-horse-battery');
    await before.deleteIdentity(authSubject);

    const after = new FileAuthProvider(filePath);
    expect(await after.verifyCredentials('jamie@example.com', 'correct-horse-battery')).toBeNull();
  });

  it('does not persist sessions - a new instance cannot verify a session issued by a previous one', async () => {
    const filePath = makeTempFilePath('auth-identities.json');
    const before = new FileAuthProvider(filePath);
    const { authSubject } = await before.createIdentity('jamie@example.com', 'correct-horse-battery');
    const { token } = await before.issueSession(authSubject);
    expect(await before.verifySession(token)).not.toBeNull();

    const after = new FileAuthProvider(filePath);
    expect(await after.verifySession(token)).toBeNull();
  });
});
