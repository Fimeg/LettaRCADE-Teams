import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Operator-level secrets, OS-keychain-encrypted via Electron safeStorage.
 * Plaintext values flow only main-process ↔ disk ↔ spawn env. The renderer
 * can write tokens (initial entry) and check presence, but never read them
 * back in the clear. If the OS keychain is unavailable (e.g. headless Linux
 * without libsecret), values are stored plaintext with a warning — failing
 * loudly is worse than letting the user proceed.
 */

const SECRETS_PATH = path.join(app.getPath('userData'), 'operator-secrets.dat');

interface SecretsBlob {
  /** Tagged storage: "enc:<base64>" or "plain:<value>" so the format is
   *  self-describing on read regardless of keychain availability shifts. */
  memfsGitToken?: string;
}

function readBlob(): SecretsBlob {
  try {
    if (!fs.existsSync(SECRETS_PATH)) return {};
    return JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8')) as SecretsBlob;
  } catch (err) {
    console.error('[operator-secrets] read failed:', err);
    return {};
  }
}

function writeBlob(blob: SecretsBlob): void {
  fs.writeFileSync(SECRETS_PATH, JSON.stringify(blob, null, 2), { mode: 0o600 });
}

export function setMemfsToken(token: string): boolean {
  const blob = readBlob();
  if (safeStorage.isEncryptionAvailable()) {
    blob.memfsGitToken = `enc:${safeStorage.encryptString(token).toString('base64')}`;
  } else {
    console.warn('[operator-secrets] OS keychain unavailable; storing token in plaintext');
    blob.memfsGitToken = `plain:${token}`;
  }
  writeBlob(blob);
  return true;
}

export function hasMemfsToken(): boolean {
  const blob = readBlob();
  return typeof blob.memfsGitToken === 'string' && blob.memfsGitToken.length > 0;
}

export function clearMemfsToken(): boolean {
  const blob = readBlob();
  if (!blob.memfsGitToken) return false;
  delete blob.memfsGitToken;
  writeBlob(blob);
  return true;
}

/** MAIN-PROCESS ONLY. Never expose this via IPC — token must not round-trip
 *  to renderer in the clear after initial entry. */
export function getMemfsToken(): string | null {
  const blob = readBlob();
  const tagged = blob.memfsGitToken;
  if (!tagged) return null;
  if (tagged.startsWith('plain:')) return tagged.slice('plain:'.length);
  if (tagged.startsWith('enc:')) {
    if (!safeStorage.isEncryptionAvailable()) {
      console.error('[operator-secrets] keychain unavailable but encrypted token present');
      return null;
    }
    try {
      return safeStorage.decryptString(
        Buffer.from(tagged.slice('enc:'.length), 'base64'),
      );
    } catch (err) {
      console.error('[operator-secrets] decrypt failed:', err);
      return null;
    }
  }
  return null;
}
