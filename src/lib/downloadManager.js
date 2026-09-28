/**
 * The offline download manager.
 *
 * Responsibilities
 *  - one queue for the whole app (concurrency 1 by default, like YouTube)
 *  - Range-based, chunked downloads into IndexedDB: pause / resume / cancel /
 *    survive a page reload (progress is persisted, so a killed tab resumes)
 *  - a storage budget check before every start (tenant cap + device quota)
 *  - "downloaded" bookkeeping + poster frame so the library renders offline
 *
 * React never mutates this store directly; it subscribes with
 * `useSyncExternalStore` and gets an immutable snapshot.
 */
import {
  CHUNK_SIZE,
  bytesRemaining,
  estimateBytesFromDuration,
  expectedChunkCount,
  parseContentRangeTotal,
  percentOf,
  planNextRequest,
  rangeHeader,
} from './chunkPlan.js';
import * as db from './db.js';
import { OfflineError, isOffline, netFetch } from './net.js';
import { DownloadError, NotDownloadableError, resolveLessonSource } from './sourceResolver.js';
import { capturePoster, getOfflinePlaybackUrl, releaseOfflinePlaybackUrl } from './media.js';
import { budgetCheck, refreshStorage, storageSnapshot } from './storage.js';

export const JOB_STATUS = {
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  FINALISING: 'finalising',
  DOWNLOADED: 'downloaded',
  ERROR: 'error',
};

const ACTIVE_STATUSES = new Set([JOB_STATUS.QUEUED, JOB_STATUS.DOWNLOADING, JOB_STATUS.FINALISING]);
const STALL_TIMEOUT_MS = 45_000;
const PERSIST_INTERVAL_MS = 1500;
const EMIT_INTERVAL_MS = 150;

const listeners = new Set();
const jobs = new Map();
const order = [];
const queue = [];
const controllers = new Map();

let activeKey = null;
let concurrency = 1;
let hydrated = false;
let tenantId = null;
let capMb = null;
let emitTimer = null;

let snapshot = {
  version: 0,
  ready: false,
  jobs: {},
  order: [],
  activeKey: null,
  queuedCount: 0,
  downloadedCount: 0,
  downloadedBytes: 0,
  storage: storageSnapshot(),
  tenantId: null,
  capMb: null,
};

/* --------------------------------------------------------------- plumbing */

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return snapshot;
}

function publicView(job) {
  const view = {};
  for (const [key, value] of Object.entries(job)) {
    if (key.startsWith('_')) continue;
    view[key] = value;
  }
  view.percent = percentOf(job.receivedBytes, job.totalBytes);
  view.isActive = ACTIVE_STATUSES.has(job.status);
  return view;
}

function publish() {
  const views = {};
  let downloadedCount = 0;
  let downloadedBytes = 0;
  for (const [key, job] of jobs) {
    views[key] = publicView(job);
    if (job.status === JOB_STATUS.DOWNLOADED) {
      downloadedCount += 1;
      downloadedBytes += job.receivedBytes || 0;
    }
  }
  snapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    ready: hydrated,
    jobs: views,
    order: order.filter((key) => jobs.has(key)),
    activeKey,
    queuedCount: queue.length,
    downloadedCount,
    downloadedBytes,
    storage: storageSnapshot(),
    tenantId,
    capMb,
  };
  listeners.forEach((listener) => listener(snapshot));
}

function emit(force = false) {
  if (force) {
    if (emitTimer) {
      clearTimeout(emitTimer);
      emitTimer = null;
    }
    publish();
    return;
  }
  if (emitTimer) return;
  emitTimer = setTimeout(() => {
    emitTimer = null;
    publish();
  }, EMIT_INTERVAL_MS);
}

function ensureOrder(key) {
  if (!order.includes(key)) order.push(key);
}

export function keyForLesson(tenant, lessonId) {
  return db.mediaKey(tenant, lessonId);
}

/* ------------------------------------------------------------- public API */

export function configure({ tenantId: nextTenant, capMb: nextCap } = {}) {
  let changed = false;
  if (nextTenant && nextTenant !== tenantId) {
    tenantId = nextTenant;
    changed = true;
  }
  if (nextCap !== undefined && nextCap !== capMb) {
    capMb = nextCap;
    changed = true;
  }
  if (changed) publish();
}

export function getCapMb() {
  return capMb;
}

export function setCapMb(next) {
  capMb = next ?? null;
  publish();
}

/** Called when a downloaded lesson is played (feeds LRU-style cleanup later). */
export function markAccessed(tenant, lessonId) {
  const job = jobs.get(db.mediaKey(tenant, lessonId));
  if (!job) return;
  job.lastAccessAt = Date.now();
  db.touchMedia(tenant, lessonId).catch(() => {});
}

/** Loads what is already downloaded for this tenant (fresh page load / reload). */
export async function hydrate() {
  const records = await db.listMediaRecords(tenantId);
  for (const record of records) {
    if (!record?.key) continue;
    const existing = jobs.get(record.key);
    if (!existing) {
      jobs.set(record.key, jobFromRecord(record));
      ensureOrder(record.key);
      continue;
    }
    if (!ACTIVE_STATUSES.has(existing.status) && record.receivedBytes > existing.receivedBytes) {
      Object.assign(existing, jobFromRecord(record));
    }
  }
  // A partial download from a killed tab becomes "paused" so the student can
  // resume it; stale records with zero bytes are cleaned up.
  for (const job of [...jobs.values()]) {
    if (job.status === JOB_STATUS.DOWNLOADED) continue;
    if (!job.receivedBytes) {
      jobs.delete(job.key);
      await db.deleteMedia(job.tenantId, job.lessonId).catch(() => {});
      continue;
    }
    job.status = JOB_STATUS.PAUSED;
    job.error = isOffline()
      ? 'Waiting for internet connection.'
      : 'Paused. Tap resume to finish.';
    // Tag the offline-parked jobs so the app can auto-resume them the moment the
    // connection returns, even after a reload.
    job.code = isOffline() ? 'offline' : job.code || null;
  }
  hydrated = true;
  await refreshStorage();
  emit(true);
  pump();
  return snapshot;
}

export function getJob(tenant, lessonId) {
  return snapshot.jobs[db.mediaKey(tenant, lessonId)] || null;
}

/** Bytes this one lesson still needs, or null when the size is unknown yet. */
export function remainingBytesFor(lesson, tenant = tenantId) {
  const job = jobs.get(db.mediaKey(tenant, lesson.id));
  if (!job?.totalBytes) return null;
  return bytesRemaining(job.receivedBytes, job.totalBytes);
}

function usedOfflineBytes(excludeKey) {
  let total = 0;
  for (const job of jobs.values()) {
    if (job.key === excludeKey) continue;
    total += job.receivedBytes || 0;
  }
  return total;
}

/** Pre-flight check exposed to the UI ("will this fit?"). */
export function checkBudget(lesson, tenant = tenantId) {
  const key = db.mediaKey(tenant, lesson.id);
  const job = jobs.get(key);
  const storage = storageSnapshot();
  // Until the server reports a real size, fall back to a duration estimate so a
  // 90-minute lecture is not treated as "free".
  const needed =
    remainingBytesFor(lesson, tenant) ??
    Math.max(0, estimateBytesFromDuration(lesson?.durationSec) - (job?.receivedBytes || 0));
  const result = budgetCheck({
    usedBytes: usedOfflineBytes(key),
    neededBytes: needed,
    capMb,
    quotaBytes: storage.quota || null,
  });
  return { ...result, neededBytes: needed };
}

/**
 * Queue one lesson. Returns { ok, reason } so the UI can explain itself
 * (already downloaded / in progress / no space / stream-only).
 */
export async function enqueue(lesson, context = {}) {
  const tenant = context.tenantId || tenantId;
  const key = db.mediaKey(tenant, lesson.id);
  const existing = jobs.get(key);

  if (existing?.status === JOB_STATUS.DOWNLOADED) {
    return { ok: false, key, reason: 'already-downloaded', job: publicView(existing) };
  }
  if (existing && ACTIVE_STATUSES.has(existing.status)) {
    return { ok: false, key, reason: 'in-progress', job: publicView(existing) };
  }

  const job = existing || createJob(lesson, { ...context, tenantId: tenant });
  jobs.set(key, job);
  ensureOrder(key);

  const budget = checkBudget(lesson, tenant);
  if (!budget.ok) {
    job.status = JOB_STATUS.ERROR;
    job.error = budget.reason;
    job.code = `budget:${budget.limit}`;
    await persist(job, true);
    emit(true);
    return { ok: false, key, reason: budget.limit, message: budget.reason, job: publicView(job) };
  }

  job.status = isOffline() ? JOB_STATUS.PAUSED : JOB_STATUS.QUEUED;
  job.error = isOffline() ? 'Waiting for internet connection.' : null;
  job.code = null;
  if (!isOffline() && !queue.includes(key)) queue.push(key);
  await persist(job, true);
  emit(true);
  pump();
  return { ok: true, key, reason: null, job: publicView(job) };
}

/** "Save whole course offline" — queued one after another. */
export async function enqueueMany(lessons, context = {}) {
  const results = [];
  for (const lesson of lessons) {
    // Sequential on purpose: one Range request at a time keeps the queue honest.
    // eslint-disable-next-line no-await-in-loop
    results.push(await enqueue(lesson, context));
  }
  return results;
}

export function pause(key) {
  const job = jobs.get(key);
  if (!job) return;
  const index = queue.indexOf(key);
  if (index >= 0) queue.splice(index, 1);
  controllers.get(key)?.abort();
  if (job.status === JOB_STATUS.DOWNLOADING || job.status === JOB_STATUS.QUEUED) {
    job.status = JOB_STATUS.PAUSED;
    job.error = 'Paused. Tap resume to finish.';
    persist(job, true);
  }
  emit(true);
}

export function pauseAll() {
  [...jobs.keys()].forEach(pause);
}

export function resume(key) {
  const job = jobs.get(key);
  if (!job) return { ok: false, reason: 'unknown' };
  if (job.status === JOB_STATUS.DOWNLOADED) return { ok: false, reason: 'already-downloaded' };
  if (ACTIVE_STATUSES.has(job.status)) return { ok: false, reason: 'in-progress' };

  const budget = checkBudget({ id: job.lessonId, durationSec: job.durationSec }, job.tenantId);
  if (!budget.ok) {
    job.status = JOB_STATUS.ERROR;
    job.error = budget.reason;
    job.code = `budget:${budget.limit}`;
    persist(job, true);
    emit(true);
    return { ok: false, reason: budget.limit, message: budget.reason };
  }

  job.status = isOffline() ? JOB_STATUS.PAUSED : JOB_STATUS.QUEUED;
  job.error = isOffline() ? 'Waiting for internet connection.' : null;
  job.code = null;
  if (!isOffline() && !queue.includes(key)) queue.push(key);
  persist(job, true);
  emit(true);
  pump();
  return { ok: true };
}

/** Remove a download completely (chunks + record) — frees storage instantly. */
export async function remove(key) {
  const job = jobs.get(key);
  const index = queue.indexOf(key);
  if (index >= 0) queue.splice(index, 1);
  controllers.get(key)?.abort();
  controllers.delete(key);

  if (job) {
    jobs.delete(key);
    releaseOfflinePlaybackUrl(job.tenantId, job.lessonId);
    await db.deleteMedia(job.tenantId, job.lessonId).catch(() => {});
  }
  await refreshStorage();
  emit(true);
  return { ok: true };
}

export async function clearAll() {
  const keys = [...jobs.keys()];
  for (const key of keys) {
    // eslint-disable-next-line no-await-in-loop
    await remove(key);
  }
  await refreshStorage();
  emit(true);
  return keys.length;
}

/* ------------------------------------------------------------------ queue */

function pump() {
  if (isOffline()) {
    emit(true);
    return;
  }
  // Only jobs that are actually transferring occupy a concurrency slot; a job
  // that is merely `queued` must not block the queue (otherwise nothing starts).
  while (queue.length && countRunning() < concurrency) {
    const key = queue.shift();
    const job = jobs.get(key);
    if (!job || job.status === JOB_STATUS.DOWNLOADED) continue;
    if (!ACTIVE_STATUSES.has(job.status)) continue; // paused / errored: wait for the student
    runJob(job).catch((error) => {
      job.status = JOB_STATUS.ERROR;
      job.error = error?.message || 'Download failed.';
      persist(job, true);
      emit(true);
    });
  }
  emit(true);
}

/** Jobs currently holding the download slot (runJob flips this synchronously). */
function countRunning() {
  let count = 0;
  for (const job of jobs.values()) {
    if (job.status === JOB_STATUS.DOWNLOADING || job.status === JOB_STATUS.FINALISING) count += 1;
  }
  return count;
}

/* ------------------------------------------------------------ job records */

function createJob(lesson, context) {
  const tenant = context.tenantId || tenantId;
  return {
    key: db.mediaKey(tenant, lesson.id),
    tenantId: tenant,
    lessonId: lesson.id,
    courseId: context.courseId || null,
    courseTitle: context.courseTitle || null,
    title: lesson.title || 'Untitled lesson',
    subject: context.subject || null,
    topic: lesson.topic || null,
    durationSec: lesson.durationSec || null,
    youtubeUrl: lesson.youtubeUrl || null,
    sourceUrl: lesson.sourceUrl || null,
    mimeType: 'video/mp4',
    status: JOB_STATUS.QUEUED,
    error: null,
    code: null,
    via: null,
    receivedBytes: 0,
    totalBytes: null,
    chunkCount: 0,
    bytesPerSecond: 0,
    downloadedAt: null,
    lastAccessAt: Date.now(),
    posterDataUrl: null,
    addedAt: Date.now(),
    _lastTickAt: Date.now(),
    _lastTickBytes: 0,
    _lastPersistAt: 0,
  };
}

function jobFromRecord(record) {
  return {
    ...record,
    status: record.status === JOB_STATUS.DOWNLOADED ? JOB_STATUS.DOWNLOADED : JOB_STATUS.PAUSED,
    error: record.error || null,
    bytesPerSecond: 0,
    _lastTickAt: Date.now(),
    _lastTickBytes: record.receivedBytes || 0,
    _lastPersistAt: Date.now(),
  };
}

function toRecord(job) {
  return {
    key: job.key,
    tenantId: job.tenantId,
    lessonId: job.lessonId,
    courseId: job.courseId,
    courseTitle: job.courseTitle,
    title: job.title,
    subject: job.subject,
    topic: job.topic,
    durationSec: job.durationSec,
    youtubeUrl: job.youtubeUrl,
    sourceUrl: job.sourceUrl,
    mimeType: job.mimeType,
    status: job.status,
    error: job.error || null,
    code: job.code || null,
    via: job.via || null,
    receivedBytes: job.receivedBytes || 0,
    totalBytes: job.totalBytes || null,
    chunkCount: job.chunkCount || 0,
    downloadedAt: job.downloadedAt || null,
    lastAccessAt: job.lastAccessAt || Date.now(),
    posterDataUrl: job.posterDataUrl || null,
    addedAt: job.addedAt || Date.now(),
  };
}

async function persist(job, force = false) {
  if (!force && Date.now() - (job._lastPersistAt || 0) < PERSIST_INTERVAL_MS) return;
  job._lastPersistAt = Date.now();
  try {
    await db.putMediaRecord(toRecord(job));
  } catch (error) {
    if (error?.name === 'QuotaExceededError') throw error;
    // Bookkeeping writes must never kill an otherwise healthy download.
  }
}


/* -------------------------------------------------------------- downloads */

const MAX_REQUESTS = 4096; // ~4 GB of 1 MiB chunks: a hard stop against runaway loops
const MAX_EMPTY_ROUNDS = 3;

async function runJob(job) {
  const controller = new AbortController();
  controllers.set(job.key, controller);
  activeKey = job.key;
  job.status = JOB_STATUS.DOWNLOADING;
  job.error = null;
  job.code = null;
  job.startedAt = Date.now();
  job._lastTickAt = Date.now();
  job._lastTickBytes = job.receivedBytes || 0;
  emit(true);

  let abortReason = null;
  const abortWith = (reason) => {
    abortReason = reason;
    controller.abort();
  };

  try {
    const lessonRef = {
      id: job.lessonId,
      title: job.title,
      sourceUrl: job.sourceUrl,
      youtubeUrl: job.youtubeUrl,
      durationSec: job.durationSec,
    };

    // Re-resolved on every start: this is where the tenant's entitlement is
    // re-checked and where a fresh signed URL comes from.
    const source = await resolveLessonSource(lessonRef, { tenantId: job.tenantId });
    job.via = source.via;
    job.mimeType = source.mimeType || job.mimeType;
    if (source.sizeBytes && !job.totalBytes) job.totalBytes = source.sizeBytes;
    await persist(job, true);

    await downloadToStore(job, source.url, controller.signal, abortWith);
    await finaliseJob(job);
  } catch (error) {
    if (abortReason) {
      job.status = JOB_STATUS.PAUSED;
      job.error = abortReason.message;
      job.code = abortReason.code || 'stalled';
    } else if (error?.name === 'AbortError') {
      job.status = JOB_STATUS.PAUSED;
      job.error = 'Paused. Tap resume to finish.';
      job.code = 'paused';
    } else if (error instanceof OfflineError) {
      job.status = JOB_STATUS.PAUSED;
      job.error = 'Waiting for internet connection. Your progress is saved.';
      job.code = 'offline';
    } else if (error instanceof NotDownloadableError) {
      job.status = JOB_STATUS.ERROR;
      job.error = error.message;
      job.code = error.code;
      job.retryable = false;
    } else if (error instanceof DownloadError) {
      job.status = JOB_STATUS.ERROR;
      job.error = error.message;
      job.code = error.code;
      job.retryable = error.retryable;
    } else if (error?.name === 'QuotaExceededError') {
      job.status = JOB_STATUS.ERROR;
      job.error = 'This device ran out of browser storage. Remove a downloaded lesson and try again.';
      job.code = 'quota';
      job.retryable = false;
    } else {
      job.status = JOB_STATUS.ERROR;
      job.error = error?.message || 'Download failed. Tap retry.';
      job.code = 'unknown';
      job.retryable = true;
    }
    await persist(job, true).catch(() => {});
  } finally {
    controllers.delete(job.key);
    if (activeKey === job.key) activeKey = null;
    emit(true);
    pump();
  }
}

/**
 * The Range loop. Every pass asks for one 1 MiB window, stores it as a chunk and
 * repeats until the file is complete — so a pause, a page reload or a dropped
 * connection only costs the bytes that were not committed yet.
 */
async function downloadToStore(job, url, signal, abortWith) {
  let rangeSupported = true;
  let guard = 0;
  let emptyRounds = 0;
  let previouslyCommitted = job.receivedBytes || 0;

  for (;;) {
    const plan = planNextRequest({
      receivedBytes: job.receivedBytes || 0,
      totalBytes: job.totalBytes,
      chunkSize: CHUNK_SIZE,
      rangeSupported,
    });
    if (plan.done) return;

    if (plan.restart && job.receivedBytes > 0) {
      await db.deleteChunks(job.key);
      job.receivedBytes = 0;
      job.chunkCount = 0;
    }
    if (guard++ > MAX_REQUESTS) {
      throw new DownloadError('This download could not be finished. Try again later.', { code: 'too-long' });
    }

    const response = await netFetch(url, {
      headers: {
        Range: rangeHeader(plan.start, plan.end),
        accept: 'video/mp4,video/*;q=0.9,*/*;q=0.5',
      },
      signal,
      cache: 'no-store',
      credentials: 'include',
    });

    if (response.status === 416) {
      // Our idea of the file size was wrong: forget it and start from zero.
      await db.deleteChunks(job.key);
      job.receivedBytes = 0;
      job.chunkCount = 0;
      job.totalBytes = null;
      rangeSupported = true;
      continue;
    }

    if (!response.ok && response.status !== 206) {
      if (response.status === 401 || response.status === 403) {
        throw new DownloadError('Your enrolment no longer allows this download. Please sign in again.', {
          retryable: false,
          code: 'unauthorised',
        });
      }
      if (response.status === 404) {
        throw new DownloadError('The video file is no longer on the server. Ask your tuition centre to re-upload it.', {
          retryable: false,
          code: 'missing',
        });
      }
      throw new DownloadError(`The server refused the download (HTTP ${response.status}).`, { code: 'http' });
    }

    if (plan.start > 0 && response.status !== 206) {
      // The server ignored our Range, so the partial data is unusable: start clean.
      await db.deleteChunks(job.key);
      job.receivedBytes = 0;
      job.chunkCount = 0;
      job.totalBytes = null;
      rangeSupported = false;
      continue;
    }

    const totalFromHeader = parseContentRangeTotal(response.headers.get('content-range'));
    if (totalFromHeader) {
      job.totalBytes = totalFromHeader;
    } else if (response.status === 200) {
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > 0) job.totalBytes = plan.start + length;
    }
    if (job.totalBytes) {
      job.chunkCount = Math.max(job.chunkCount || 0, expectedChunkCount(job.totalBytes));
    }
    emit(false);

    const round = await streamResponse(job, response, plan, signal, abortWith);

    const committed = job.receivedBytes || 0;
    if (job.totalBytes && committed >= job.totalBytes) return;
    if (!job.totalBytes && round.ended) return;

    if (committed === previouslyCommitted) {
      emptyRounds += 1;
      if (emptyRounds > MAX_EMPTY_ROUNDS) {
        throw new DownloadError('The download kept stalling without delivering data. Tap retry.', { code: 'stalled' });
      }
    } else {
      emptyRounds = 0;
    }
    previouslyCommitted = committed;
  }
}

/**
 * Reads one response and writes it out as 1 MiB chunks.
 * Returns how much was read and whether the body ended on its own.
 */
async function streamResponse(job, response, plan, signal, abortWith) {
  const buffer = new Uint8Array(CHUNK_SIZE);
  let buffered = 0;
  let index = Math.floor(plan.start / CHUNK_SIZE);
  let readBytes = 0;
  let ended = false;
  let stallTimer = null;

  const armStall = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      abortWith(
        new DownloadError('The connection stalled. Your progress is saved — tap resume.', { code: 'stalled' }),
      );
    }, STALL_TIMEOUT_MS);
  };

  const flush = async (bytes) => {
    await commitChunk(job, index, buffer.slice(0, bytes), bytes);
    index += 1;
    buffered = 0;
  };

  const push = async (value) => {
    readBytes += value.byteLength;
    let offset = 0;
    while (offset < value.byteLength) {
      const room = CHUNK_SIZE - buffered;
      const take = Math.min(room, value.byteLength - offset);
      buffer.set(value.subarray(offset, offset + take), buffered);
      buffered += take;
      offset += take;
      if (buffered === CHUNK_SIZE) await flush(CHUNK_SIZE);
    }
  };

  if (signal.aborted) {
    const aborted = new Error('Aborted');
    aborted.name = 'AbortError';
    throw aborted;
  }

  try {
    const reader = response.body?.getReader?.();
    if (reader) {
      armStall();
      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const { value, done } = await reader.read();
        armStall();
        if (done) {
          ended = true;
          break;
        }
        if (value?.byteLength) await push(value);
      }
    } else {
      // No ReadableStream support: take the whole range in one go.
      const whole = new Uint8Array(await response.arrayBuffer());
      ended = true;
      if (whole.byteLength) await push(whole);
    }
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
  }

  // The trailing partial chunk is committed only when it truly is the end of the
  // file. Anything else is dropped on purpose: unaligned bytes would corrupt a
  // later resume, and re-fetching 1 MiB is cheap.
  const total = job.totalBytes;
  const isEnd = total ? (job.receivedBytes || 0) + buffered >= total : ended;
  if (buffered > 0 && isEnd) await flush(buffered);

  return { readBytes, ended, leftover: buffered };
}

/** Stores one chunk and updates progress. Quota errors bubble up as friendly ones. */
async function commitChunk(job, index, payload, bytes) {
  try {
    await db.putChunk(job.key, index, new Blob([payload], { type: job.mimeType || 'video/mp4' }), bytes);
  } catch (error) {
    if (error?.name === 'QuotaExceededError' || error?.name === 'UnknownError') {
      throw new DownloadError(
        'This device ran out of browser storage. Remove a downloaded lesson and tap retry.',
        { retryable: true, code: 'quota' },
      );
    }
    throw error;
  }

  job.receivedBytes = (job.receivedBytes || 0) + bytes;
  job.chunkCount = Math.max(job.chunkCount || 0, index + 1);

  const now = Date.now();
  const elapsed = now - (job._lastTickAt || now);
  if (elapsed >= 400) {
    const delta = job.receivedBytes - (job._lastTickBytes || 0);
    const instant = (delta / elapsed) * 1000;
    job.bytesPerSecond = job.bytesPerSecond
      ? Math.round(job.bytesPerSecond * 0.6 + instant * 0.4)
      : Math.round(instant);
    job._lastTickAt = now;
    job._lastTickBytes = job.receivedBytes;
  }

  emit(false);
  await persist(job);
  maybeRefreshStorage();
}

let lastStorageRefresh = 0;
function maybeRefreshStorage() {
  const now = Date.now();
  if (now - lastStorageRefresh < 2000) return;
  lastStorageRefresh = now;
  refreshStorage();
}

/**
 * Download finished: grab a poster frame from the local file (the YouTube
 * thumbnail URL is useless offline) and flip the lesson to "Downloaded".
 */
async function finaliseJob(job) {
  job.status = JOB_STATUS.FINALISING;
  job.error = null;
  job.bytesPerSecond = 0;
  emit(true);

  try {
    const entry = await getOfflinePlaybackUrl(job.tenantId, job.lessonId, { touch: false });
    if (entry?.url && !job.posterDataUrl) {
      const poster = await capturePoster(entry.url, { atFraction: 0.25, maxWidth: 480 });
      if (poster) job.posterDataUrl = poster;
    }
  } catch {
    // A missing poster must never fail a completed download.
  }

  job.status = JOB_STATUS.DOWNLOADED;
  job.error = null;
  job.code = null;
  job.downloadedAt = Date.now();
  job.lastAccessAt = Date.now();
  if (job.totalBytes) job.receivedBytes = job.totalBytes;
  await persist(job, true).catch(() => {});
  await refreshStorage();
  emit(true);
}

/**
 * Re-checks every downloaded lesson against IndexedDB (used by the Downloads
 * screen's "Verify" action, e.g. after the browser evicted data).
 */
export async function verifyAll() {
  const results = [];
  for (const job of [...jobs.values()]) {
    // eslint-disable-next-line no-await-in-loop
    const chunks = await db.countChunks(job.key).catch(() => 0);
    const expected = job.totalBytes ? expectedChunkCount(job.totalBytes) : job.chunkCount || 0;
    const ok = expected > 0 && chunks >= expected;
    if (!ok) {
      job.status = JOB_STATUS.PAUSED;
      job.error = 'Some parts of this lesson were removed by the browser. Tap resume to download them again.';
      job.code = 'incomplete';
    } else if (job.status !== JOB_STATUS.DOWNLOADED) {
      job.status = JOB_STATUS.DOWNLOADED;
      job.error = null;
      job.code = null;
    }
    results.push({ key: job.key, ok, chunks, expected });
  }
  await refreshStorage();
  emit(true);
  return results;
}

/**
 * Read-only diagnostic dump of the download engine's internals: queue, running
 * requests and per-lesson state. Handy when a student reports "my download is
 * stuck" and the Downloads screen is not enough.
 */
export function debugSnapshot() {
  return {
    queue: [...queue],
    controllers: [...controllers.keys()],
    running: countRunning(),
    activeKey,
    jobs: [...jobs.values()].map((job) => ({
      key: job.key,
      status: job.status,
      receivedBytes: job.receivedBytes,
      totalBytes: job.totalBytes,
      code: job.code || null,
    })),
  };
}


