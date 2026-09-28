/**
 * Unit tests for the pure logic behind the offline feature.
 * Run with: npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHUNK_SIZE,
  bytesRemaining,
  estimateBytesFromDuration,
  expectedChunkCount,
  isComplete,
  nextWriteOffset,
  parseContentRangeTotal,
  percentOf,
  planNextRequest,
  rangeHeader,
} from '../src/lib/chunkPlan.js';
import { formatBytes, formatDuration, formatWhen } from '../src/lib/format.js';
import { parseYoutubeId, youtubeEmbedUrl, youtubeThumbnail, youtubeWatchUrl } from '../src/lib/youtube.js';
import { budgetCheck, availableBytes } from '../src/lib/storage.js';
import { parseHash, courseHash, watchHash } from '../src/lib/router.js';

/* --------------------------------------------------------- chunk planning */

test('expectedChunkCount rounds up partial chunks', () => {
  assert.equal(expectedChunkCount(0), 0);
  assert.equal(expectedChunkCount(1), 1);
  assert.equal(expectedChunkCount(CHUNK_SIZE), 1);
  assert.equal(expectedChunkCount(CHUNK_SIZE + 1), 2);
  assert.equal(expectedChunkCount(2.5 * CHUNK_SIZE), 3);
  assert.equal(expectedChunkCount(null), 0);
});

test('a fresh download asks for exactly one chunk window', () => {
  const plan = planNextRequest({ receivedBytes: 0, totalBytes: 2.5 * CHUNK_SIZE });
  assert.equal(plan.done, false);
  assert.equal(plan.start, 0);
  assert.equal(plan.end, CHUNK_SIZE - 1);
  assert.equal(rangeHeader(plan.start, plan.end), `bytes=0-${CHUNK_SIZE - 1}`);
});

test('resume continues at the next chunk boundary (never mid-chunk)', () => {
  const plan = planNextRequest({ receivedBytes: CHUNK_SIZE, totalBytes: 3 * CHUNK_SIZE });
  assert.equal(plan.start, CHUNK_SIZE);
  assert.equal(plan.end, 2 * CHUNK_SIZE - 1);

  // A partial byte count still resumes from the last committed chunk.
  const ragged = planNextRequest({ receivedBytes: 1.5 * CHUNK_SIZE, totalBytes: 3 * CHUNK_SIZE });
  assert.equal(ragged.start, CHUNK_SIZE);
});

test('the last request is clamped to the real end of the file', () => {
  const total = 2.5 * CHUNK_SIZE;
  const plan = planNextRequest({ receivedBytes: 2 * CHUNK_SIZE, totalBytes: total });
  assert.equal(plan.start, 2 * CHUNK_SIZE);
  assert.equal(plan.end, total - 1);
});

test('a completed download plans nothing further', () => {
  const plan = planNextRequest({ receivedBytes: 5 * CHUNK_SIZE, totalBytes: 5 * CHUNK_SIZE });
  assert.equal(plan.done, true);
  assert.equal(isComplete(5 * CHUNK_SIZE, 5 * CHUNK_SIZE), true);
  assert.equal(isComplete(4 * CHUNK_SIZE, 5 * CHUNK_SIZE), false);
});

test('servers without Range support force a clean restart', () => {
  const plan = planNextRequest({ receivedBytes: 2 * CHUNK_SIZE, totalBytes: 9 * CHUNK_SIZE, rangeSupported: false });
  assert.equal(plan.restart, true);
  assert.equal(plan.start, 0);
});

test('unknown total size still produces a bounded window', () => {
  const plan = planNextRequest({ receivedBytes: 0, totalBytes: null });
  assert.equal(plan.end, CHUNK_SIZE - 1);
  const resumed = planNextRequest({ receivedBytes: 3 * CHUNK_SIZE, totalBytes: null });
  assert.equal(resumed.start, 3 * CHUNK_SIZE);
  assert.equal(resumed.end, 4 * CHUNK_SIZE - 1);
});

test('progress maths never produces NaN or out-of-range values', () => {
  assert.equal(percentOf(0, null), 0);
  assert.equal(percentOf(5, 0), 0);
  assert.equal(percentOf(1, 2), 50);
  assert.equal(percentOf(3, 2), 100);
  assert.equal(bytesRemaining(1, 5), 4);
  assert.equal(bytesRemaining(5, 5), 0);
  assert.equal(bytesRemaining(0, null), null);
});

test('content-range parsing understands real headers', () => {
  assert.equal(parseContentRangeTotal('bytes 0-1048575/2500000'), 2500000);
  assert.equal(parseContentRangeTotal('bytes */0'), null);
  assert.equal(parseContentRangeTotal('bytes 0-10/*'), null);
  assert.equal(parseContentRangeTotal(''), null);
});

test('nextWriteOffset floors to the committed chunk', () => {
  assert.equal(nextWriteOffset(CHUNK_SIZE + 5), CHUNK_SIZE);
  assert.equal(nextWriteOffset(5), 0);
});

test('duration estimate gives the budget check a number to work with', () => {
  assert.equal(estimateBytesFromDuration(0), 0);
  // 800 s at ~800 kbps is roughly 80 MB, the number the pre-flight check uses.
  assert.equal(estimateBytesFromDuration(800), 80_000_000);
  assert.ok(estimateBytesFromDuration(3600) < 400 * 1024 * 1024);
});

/* ------------------------------------------------------------- formatting */

test('byte sizes are readable and safe', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024), '1.5 GB');
  assert.equal(formatBytes(-1), '--');
  assert.equal(formatBytes('nope'), '--');
});

test('durations look like a video player clock', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(59), '0:59');
  assert.equal(formatDuration(596), '9:56');
  assert.equal(formatDuration(3723), '1:02:03');
});

test('relative timestamps stay human', () => {
  const now = Date.UTC(2026, 0, 10, 12, 0, 0);
  assert.equal(formatWhen(now - 30_000, now), 'just now');
  assert.equal(formatWhen(now - 5 * 60_000, now), '5 min ago');
  assert.equal(formatWhen(now - 3 * 3600_000, now), '3 h ago');
  assert.equal(formatWhen(now - 2 * 86_400_000, now), '2 d ago');
});

/* ---------------------------------------------------------------- youtube */

test('every common YouTube url shape resolves to a video id', () => {
  const id = 'M7lc1UVf-VE';
  assert.equal(parseYoutubeId(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(parseYoutubeId(`https://youtu.be/${id}`), id);
  assert.equal(parseYoutubeId(`https://www.youtube.com/embed/${id}?rel=0`), id);
  assert.equal(parseYoutubeId(`https://m.youtube.com/shorts/${id}`), id);
  assert.equal(parseYoutubeId(`https://www.youtube-nocookie.com/embed/${id}`), id);
  assert.equal(parseYoutubeId(id), id);
  assert.equal(parseYoutubeId('https://vimeo.com/12345'), null);
  assert.equal(parseYoutubeId(''), null);
  assert.equal(parseYoutubeId(null), null);
});

test('embed urls are privacy friendly and configurable', () => {
  const url = youtubeEmbedUrl('https://youtu.be/M7lc1UVf-VE', { autoplay: true, startSeconds: 30 });
  assert.match(url, /^https:\/\/www\.youtube-nocookie\.com\/embed\/M7lc1UVf-VE\?/);
  assert.match(url, /autoplay=1/);
  assert.match(url, /start=30/);
  assert.equal(youtubeEmbedUrl('nonsense'), null);
});

test('thumbnail and watch urls are derived from the id', () => {
  assert.equal(youtubeThumbnail('M7lc1UVf-VE'), 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg');
  assert.equal(youtubeWatchUrl('M7lc1UVf-VE'), 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
});

/* ----------------------------------------------------------- storage rules */

test('the plan cap blocks a download that would not fit', () => {
  const MB = 1024 * 1024;
  const fits = budgetCheck({ usedBytes: 10 * MB, neededBytes: 40 * MB, capMb: 100 });
  assert.equal(fits.ok, true);

  const tooBig = budgetCheck({ usedBytes: 90 * MB, neededBytes: 40 * MB, capMb: 100 });
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.limit, 'tenant-cap');
  assert.match(tooBig.reason, /100 MB/);
});

test('the device quota blocks a download near the browser limit', () => {
  const MB = 1024 * 1024;
  const blocked = budgetCheck({
    usedBytes: 900 * MB,
    neededBytes: 100 * MB,
    capMb: null,
    quotaBytes: 1000 * MB,
    safetyBytes: 50 * MB,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.limit, 'device-quota');
});

test('a resume is measured against the bytes that are still missing', () => {
  const MB = 1024 * 1024;
  // 95 MB already used, 20 MB file of which 10 MB is stored -> only 10 MB needed.
  const check = budgetCheck({ usedBytes: 85 * MB, neededBytes: 10 * MB, capMb: 100 });
  assert.equal(check.ok, true);
});

test('availableBytes returns the tighter of plan cap and quota', () => {
  const MB = 1024 * 1024;
  assert.equal(availableBytes({ usage: 10 * MB, quota: 0, capMb: 100 }), 90 * MB);
  assert.equal(availableBytes({ usage: 10 * MB, quota: 40 * MB, capMb: null }), 30 * MB);
  assert.equal(availableBytes({ usage: 1, quota: 0, capMb: null }), null);
});

/* ------------------------------------------------------------------ router */

test('routes parse from the hash and survive odd input', () => {
  assert.equal(parseHash('').name, 'courses');
  assert.equal(parseHash('#/').name, 'courses');
  assert.equal(parseHash('#/downloads').name, 'downloads');
  assert.equal(parseHash('#/settings').name, 'settings');

  const course = parseHash('#/course/c-physics-12');
  assert.equal(course.name, 'course');
  assert.equal(course.courseId, 'c-physics-12');

  const watch = parseHash('#/watch/c-physics-12/l-newton-laws');
  assert.equal(watch.name, 'watch');
  assert.equal(watch.courseId, 'c-physics-12');
  assert.equal(watch.lessonId, 'l-newton-laws');

  assert.equal(parseHash('#/nope').name, 'notfound');
  assert.equal(parseHash('#/watch/only-course').name, 'notfound');
});

test('hash builders round-trip through the parser', () => {
  const hash = watchHash('c 1', 'l/2');
  assert.equal(parseHash(hash).courseId, 'c 1');
  assert.equal(parseHash(hash).lessonId, 'l/2');
  assert.equal(parseHash(courseHash('c-physics-12')).courseId, 'c-physics-12');
});

