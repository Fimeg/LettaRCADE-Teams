import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const PROFILE_PATH = path.join(app.getPath('userData'), 'operator-profile.json');

/**
 * Single operator profile per install. Letta Community ADE is single-human-
 * per-machine by design — this is not a user table. Secrets (e.g. memfs git
 * token) live in the OS keychain via a separate seam, never in this file.
 */
export interface OperatorProfile {
  displayName: string;
  /** URL template for `LETTA_MEMFS_GIT_URL` with `{agentId}` placeholder.
   *  E.g. "http://host:4455/Fimeg/{agentId}.git". Token NOT embedded here —
   *  it's pulled from the keychain at spawn time and prefixed onto the URL. */
  memfsGitUrlTemplate?: string;
  createdAt: number;
  updatedAt: number;
}

export function loadOperatorProfile(): OperatorProfile | null {
  try {
    if (!fs.existsSync(PROFILE_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
    if (typeof parsed?.displayName !== 'string' || !parsed.displayName.trim()) {
      return null;
    }
    return parsed as OperatorProfile;
  } catch (error) {
    console.error('[operator-profile] failed to load:', error);
    return null;
  }
}

export function saveOperatorProfile(
  partial: Partial<Omit<OperatorProfile, 'createdAt' | 'updatedAt'>>,
): OperatorProfile {
  const existing = loadOperatorProfile();
  const now = Date.now();
  const merged: OperatorProfile = {
    displayName: partial.displayName ?? existing?.displayName ?? '',
    memfsGitUrlTemplate:
      partial.memfsGitUrlTemplate !== undefined
        ? partial.memfsGitUrlTemplate
        : existing?.memfsGitUrlTemplate,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (!merged.displayName.trim()) {
    throw new Error('displayName is required');
  }
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(merged, null, 2));
  return merged;
}
