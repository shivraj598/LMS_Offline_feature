/** Parses the total size out of a Content-Range header: `bytes 0-1048575/12345678`. */
export function parseContentRangeTotal(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const match = /\/(\d+)\s*$/.exec(headerValue.trim());
  if (!match) return null;
  const total = Number(match[1]);
  return Number.isFinite(total) && total > 0 ? total : null;
}

/** Range header value for one chunk request. */
export function rangeHeader(start, end) {
  return `bytes=${Math.max(0, start)}-${Math.max(0, end)}`;
}

/**
 * Pure helpers that decide how a video is split into chunks and how a paused
 * download resumes. Kept free of browser APIs so it can be unit tested in Node.
 */

/** Size of one stored chunk. 1 MiB balances IndexedDB record count vs. resume granularity. */
export const CHUNK_SIZE = 1024 * 1024;

/** @returns {number} how many chunk records a fully downloaded media will have. */
export function expectedChunkCount(totalBytes, chunkSize = CHUNK_SIZE) {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 0;
  return Math.ceil(totalBytes / chunkSize);
}

/** Byte offset (relative to the end of the last committed chunk) of the next write. */
export function nextWriteOffset(receivedBytes, chunkSize = CHUNK_SIZE) {
  return Math.max(0, Math.floor(receivedBytes / chunkSize) * chunkSize);
}

/**
 * Decide the next HTTP Range request for a job.
 * `rangeSupported === false` forces a restart because the server may have
 * already sent us bytes it will not honour ranges for.
 */
export function planNextRequest({
  receivedBytes = 0,
  totalBytes = null,
  chunkSize = CHUNK_SIZE,
  rangeSupported = true,
} = {}) {
  const knownTotal = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : null;
  const committed = knownTotal ? Math.min(receivedBytes, knownTotal) : Math.max(0, receivedBytes);

  if (knownTotal && committed >= knownTotal) {
    return { done: true, restart: false, start: knownTotal, end: knownTotal - 1, chunkSize };
  }

  const restart = !rangeSupported && receivedBytes > 0;
  const start = restart ? 0 : nextWriteOffset(committed, chunkSize);
  const hardEnd = knownTotal ? knownTotal - 1 : null;
  const wantedEnd = start + chunkSize - 1;
  const end = hardEnd === null ? wantedEnd : Math.min(wantedEnd, hardEnd);

  return { done: false, restart, start, end, chunkSize };
}

/** True when every byte described by the plan has been stored. */
export function isComplete(receivedBytes, totalBytes) {
  return (
    Number.isFinite(totalBytes) && totalBytes > 0 && receivedBytes >= totalBytes
  );
}

/** Percentage 0..100 (never NaN) for progress bars. */
export function percentOf(receivedBytes, totalBytes) {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 0;
  const pct = (receivedBytes / totalBytes) * 100;
  return Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
}

/** Bytes still needed for a lesson, used for the storage-cap check. */
export function bytesRemaining(receivedBytes, totalBytes) {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return null;
  return Math.max(0, totalBytes - Math.max(0, receivedBytes));
}

/** Rough estimate for lessons whose size is not known yet (duration based). */
export function estimateBytesFromDuration(durationSec, bitsPerSecond = 800_000) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  return Math.ceil((durationSec * bitsPerSecond) / 8);
}
