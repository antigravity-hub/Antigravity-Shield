/**
 * SemVer and update severity analysis utilities
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

/**
 * Parses a version string into semantic version components.
 * Supports prefixes like "v" and partial versions like "5.6".
 */
export function parseSemVer(versionStr: string): SemVer {
  const clean = (versionStr || '').trim().replace(/^v/i, '');
  const [majorStr = '0', minorStr = '0', patchStr = '0'] = clean.split('.');

  const major = parseInt(majorStr, 10) || 0;
  const minor = parseInt(minorStr, 10) || 0;
  // Handle pre-release tags in patch (e.g. "0-beta.1" -> 0)
  const patch = parseInt(patchStr.split(/[-+]/)[0], 10) || 0;

  return { major, minor, patch, raw: versionStr };
}

export type UpdateSeverity = 'major' | 'minor' | 'none';

/**
 * Determines update severity based on user specification:
 * - Any increase in Major OR Minor version is considered 'major' (Mandatory / Blocking)
 *   e.g. 5.3.0 -> 5.6.0, 5.3.0 -> 6.0.0
 * - Increases only in Patch are considered 'minor' (Dismissible)
 *   e.g. 5.3.0 -> 5.3.1
 */
export function getUpdateSeverity(currentVersion: string, latestVersion: string): UpdateSeverity {
  const current = parseSemVer(currentVersion);
  const latest = parseSemVer(latestVersion);

  if (latest.major > current.major) {
    return 'major';
  }

  if (latest.major === current.major && latest.minor > current.minor) {
    return 'major';
  }

  if (
    latest.major === current.major &&
    latest.minor === current.minor &&
    latest.patch > current.patch
  ) {
    return 'minor';
  }

  return 'none';
}

const GRACE_STORAGE_KEY = 'antigravity_update_grace_expiry';
const GRACE_VERSION_KEY = 'antigravity_update_grace_version';

/**
 * Checks if the user is currently within an emergency grace period for this version.
 */
export function isGracePeriodActive(targetVersion: string): boolean {
  try {
    const savedVersion = sessionStorage.getItem(GRACE_VERSION_KEY);
    const expiryStr = sessionStorage.getItem(GRACE_STORAGE_KEY);
    if (!expiryStr || savedVersion !== targetVersion) {
      return false;
    }
    const expiry = parseInt(expiryStr, 10);
    return Date.now() < expiry;
  } catch {
    return false;
  }
}

/**
 * Activates emergency grace period (default 30 minutes in sessionStorage)
 * allowing users to finish active agent tasks before updating.
 */
export function activateGracePeriod(targetVersion: string, minutes: number = 30): void {
  try {
    const expiry = Date.now() + minutes * 60 * 1000;
    sessionStorage.setItem(GRACE_VERSION_KEY, targetVersion);
    sessionStorage.setItem(GRACE_STORAGE_KEY, expiry.toString());
  } catch (err) {
    console.error('Failed to save grace period to sessionStorage:', err);
  }
}

/**
 * Clears any active grace period.
 */
export function clearGracePeriod(): void {
  try {
    sessionStorage.removeItem(GRACE_VERSION_KEY);
    sessionStorage.removeItem(GRACE_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear grace period from sessionStorage:', err);
  }
}
