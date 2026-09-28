/**
 * Offline-aware networking.
 *
 * Every request the app makes for *content* goes through `netFetch`, so a single
 * flag can prove the offline behaviour without unplugging the wifi:
 *  - real offline  : navigator.onLine === false (or the request fails anyway)
 *  - simulated     : the "Simulate offline" switch in the header
 *
 * The app shell itself is served from the service worker cache when the network
 * is gone, which is what makes "open the app with no internet" possible.
 */

export class OfflineError extends Error {
  constructor(message = 'You are offline.') {
    super(message);
    this.name = 'OfflineError';
    this.offline = true;
  }
}

let forcedOffline = false;
let apiBase = '';
const listeners = new Set();

/**
 * Absolute base for API calls. Empty in the browser (same-origin relative URLs),
 * set by Node tests that talk to a server on another port.
 */
export function setApiBase(base) {
  apiBase = base ? String(base).replace(/\/$/, '') : '';
}

export function netUrl(input) {
  const value = String(input);
  if (/^https?:/i.test(value) || !apiBase) return value;
  return `${apiBase}${value.startsWith('/') ? value : `/${value}`}`;
}

export function isForcedOffline() {
  return forcedOffline;
}

export function setForcedOffline(value) {
  const next = Boolean(value);
  if (next === forcedOffline) return;
  forcedOffline = next;
  listeners.forEach((fn) => fn());
}

export function subscribeConnectivity(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** True when the app should behave as if there is no internet. */
export function isOffline() {
  if (forcedOffline) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return false;
}

/**
 * fetch() that refuses to touch the network while "offline" and normalises the
 * common failure modes into OfflineError.
 */
export async function netFetch(input, init = {}) {
  if (isOffline()) throw new OfflineError();
  try {
    return await fetch(netUrl(input), init);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new OfflineError('Network request failed. Check your connection.');
  }
}

/** React-free helper: how many listeners care about connectivity. */
export function connectivityListenerCount() {
  return listeners.size;
}
