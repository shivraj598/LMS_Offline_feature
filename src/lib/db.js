/**
 * Offline media database.
 *
 * Everything the student downloads lives here, in the browser's private app
 * storage for this origin:
 *
 *   media : one record per lesson -> { key, tenantId, lessonId, status, bytes,
 *                                     chunkCount, posterDataUrl, ... }
 *   chunks: the video bytes, 1 MiB per record -> { key, mediaKey, index, blob }
 *   prefs : per-origin settings (storage cap, tenant, ...)
 *
 * Because this is origin-private storage (not the filesystem) the video never
 * shows up in the device's Files/Downloads/Gallery app, cannot be shared or
 * copied out, and disappears when the student clears site data or uninstalls
 * the browser. That is exactly the YouTube-Downloads-style behaviour, and it
 * also means the tenant's content is not left lying around as a loose MP4.
 */
import { openDatabase, promisifyRequest, withStores } from './idb.js';

export const DB_NAME = 'lms-offline';
export const DB_VERSION = 1;
export const STORES = { media: 'media', chunks: 'chunks', prefs: 'prefs' };

export const mediaKey = (tenantId, lessonId) => `${tenantId}::${lessonId}`;
export const chunkKeyFor = (key, index) => `${key}::${String(index).padStart(6, '0')}`;

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase(DB_NAME, DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains(STORES.media)) {
        const store = db.createObjectStore(STORES.media, { keyPath: 'key' });
        store.createIndex('byTenant', 'tenantId');
        store.createIndex('byLesson', 'lessonId');
        store.createIndex('byLastAccess', 'lastAccessAt');
      }
      if (!db.objectStoreNames.contains(STORES.chunks)) {
        const store = db.createObjectStore(STORES.chunks, { keyPath: 'key' });
        store.createIndex('byMedia', 'mediaKey');
      }
      if (!db.objectStoreNames.contains(STORES.prefs)) {
        db.createObjectStore(STORES.prefs, { keyPath: 'key' });
      }
    });
  }
  return dbPromise;
}

/** Test/teardown helper. */
export async function closeDb() {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    db.close();
  } finally {
    dbPromise = null;
  }
}

async function run(storeNames, mode, work) {
  const db = await getDb();
  return withStores(db, storeNames, mode, work);
}

/* ------------------------------------------------------------------ media */

export async function getMediaRecord(tenantId, lessonId) {
  const record = await run(STORES.media, 'readonly', (store) =>
    promisifyRequest(store.get(mediaKey(tenantId, lessonId))),
  );
  return record || null;
}

export async function listMediaRecords(tenantId) {
  const records = await run(STORES.media, 'readonly', (store) =>
    tenantId
      ? promisifyRequest(store.index('byTenant').getAll(tenantId))
      : promisifyRequest(store.getAll()),
  );
  return records || [];
}

export async function putMediaRecord(record) {
  await run(STORES.media, 'readwrite', (store) => promisifyRequest(store.put(record)));
  return record;
}

export async function patchMediaRecord(tenantId, lessonId, patch) {
  const existing = await getMediaRecord(tenantId, lessonId);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  await putMediaRecord(next);
  return next;
}

export async function touchMedia(tenantId, lessonId, at = Date.now()) {
  return patchMediaRecord(tenantId, lessonId, { lastAccessAt: at });
}


/* ----------------------------------------------------------------- chunks */

export async function putChunk(key, index, blob, bytes) {
  const record = { key: chunkKeyFor(key, index), mediaKey: key, index, bytes, blob };
  await run(STORES.chunks, 'readwrite', (store) => promisifyRequest(store.put(record)));
  return record;
}

export async function countChunks(key) {
  const count = await run(STORES.chunks, 'readonly', (store) =>
    promisifyRequest(store.index('byMedia').count(key)),
  );
  return count || 0;
}

/** All chunk records of one media, ordered by part index. */
export async function getChunkRecords(key) {
  const records = await run(STORES.chunks, 'readonly', (store) =>
    promisifyRequest(store.index('byMedia').getAll(key)),
  );
  return (records || []).sort((a, b) => a.index - b.index);
}

/** Chunk blobs in playback order — Blob() accepts the array without copying. */
export async function getChunkBlobs(key) {
  const records = await getChunkRecords(key);
  return records.map((record) => record.blob);
}

/** Drop the tail of a partial download (used when a restart is required). */
export async function deleteChunksFrom(key, index) {
  const records = await getChunkRecords(key);
  const doomed = records.filter((record) => record.index >= index);
  if (!doomed.length) return 0;
  await run(STORES.chunks, 'readwrite', (store) => {
    doomed.forEach((record) => store.delete(record.key));
    return Promise.resolve();
  });
  return doomed.length;
}

export async function deleteChunks(key) {
  const records = await getChunkRecords(key);
  if (!records.length) return 0;
  await run(STORES.chunks, 'readwrite', (store) => {
    records.forEach((record) => store.delete(record.key));
    return Promise.resolve();
  });
  return records.length;
}

/** Removes every trace of one offline lesson. */
export async function deleteMedia(tenantId, lessonId) {
  const key = mediaKey(tenantId, lessonId);
  await deleteChunks(key);
  await run(STORES.media, 'readwrite', (store) => promisifyRequest(store.delete(key)));
  return key;
}

/* ------------------------------------------------------------------ prefs */

export async function getPrefs(key = 'prefs') {
  const record = await run(STORES.prefs, 'readonly', (store) => promisifyRequest(store.get(key)));
  return record || null;
}

export async function savePrefs(patch, key = 'prefs') {
  const existing = (await getPrefs(key)) || { key };
  const next = { ...existing, ...patch, key };
  await run(STORES.prefs, 'readwrite', (store) => promisifyRequest(store.put(next)));
  return next;
}
