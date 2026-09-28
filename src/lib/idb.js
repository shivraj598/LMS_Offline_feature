/**
 * Minimal promise wrapper over IndexedDB (no dependency on `idb`).
 * Small on purpose: this file only knows about open/transaction mechanics.
 */

export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

export function openDatabase(name, version, onUpgrade) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = (event) => {
      try {
        onUpgrade?.(request.result, event.oldVersion, request.transaction);
      } catch (error) {
        reject(error);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB is blocked by another open tab.'));
  });
}

/**
 * Runs `work` against the requested stores inside one transaction and resolves
 * with the value it returns (usually a promisified request). One transaction per
 * logical operation keeps call sites simple and avoids long-lived transactions.
 */
export async function withStores(db, storeNames, mode, work) {
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const tx = db.transaction(names, mode);
  const stores = names.map((name) => tx.objectStore(name));
  return work(...stores);
}
