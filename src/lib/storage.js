/**
 * Storage budget + quota handling.
 *
 * Two limits matter for an offline video feature:
 *  1. the browser quota (how much the origin may keep), and
 *  2. the tenant's own cap (a "Pro" plan might allow 500 MB per student).
 *
 * We also ask for *persistent* storage so the browser does not evict a
 * student's downloads when the device runs low on space.
 */

const MB = 1024 * 1024;
const listeners = new Set();

let snapshot = {
  usage: 0,
  quota: 0,
  persisted: false,
  supported: typeof navigator !== 'undefined' && Boolean(navigator.storage?.estimate),
  updatedAt: 0,
};

let inflight = null;

export function storageSnapshot() {
  return snapshot;
}

export function subscribeStorage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function publish(next) {
  snapshot = { ...snapshot, ...next, updatedAt: Date.now() };
  listeners.forEach((fn) => fn(snapshot));
}

/** Reads navigator.storage.estimate(); de-duplicated and never throws. */
export async function refreshStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return snapshot;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const estimate = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      publish({ usage: estimate.usage || 0, quota: estimate.quota || 0, persisted, supported: true });
    } catch {
      publish({ supported: false });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Ask the browser to keep our data (best effort, may be denied). */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    const granted = await navigator.storage.persist();
    publish({ persisted: granted });
    return granted;
  } catch {
    return false;
  }
}

/**
 * Pure budget check — unit tested.
 * `neededBytes` is what the student is about to download, `usedBytes` what the
 * tenant's offline library already occupies.
 */
export function budgetCheck({
  usedBytes = 0,
  neededBytes = 0,
  capMb = null,
  quotaBytes = null,
  safetyBytes = 50 * MB,
} = {}) {
  const needed = Math.max(0, neededBytes || 0);
  const used = Math.max(0, usedBytes || 0);

  if (Number.isFinite(capMb) && capMb > 0) {
    const cap = capMb * MB;
    if (used + needed > cap) {
      return {
        ok: false,
        reason: `Your plan allows ${capMb} MB of offline videos and ${Math.round(used / MB)} MB is already saved. Remove a lesson or raise the cap in Settings.`,
        limit: 'tenant-cap',
      };
    }
  }

  if (Number.isFinite(quotaBytes) && quotaBytes > 0 && quotaBytes - used - needed < safetyBytes) {
    return {
      ok: false,
      reason: 'This device does not have enough free browser storage left for that lesson. Remove a downloaded lesson first.',
      limit: 'device-quota',
    };
  }

  return { ok: true, reason: null, limit: null };
}

/** Human readable "how much room is left" for the storage meter. */
export function availableBytes({ usage = 0, quota = 0, capMb = null } = {}) {
  const quotaAvail = quota > 0 ? Math.max(0, quota - usage) : Number.POSITIVE_INFINITY;
  const capAvail = Number.isFinite(capMb) && capMb > 0 ? Math.max(0, capMb * MB - usage) : Number.POSITIVE_INFINITY;
  const min = Math.min(quotaAvail, capAvail);
  return Number.isFinite(min) ? min : null;
}
