/**
 * End-to-end test of the offline download engine, with no internet required.
 *
 * A tiny express server plays the part of the LMS API and the tuition centre's
 * asset host:
 *   GET /api/tenant/:t/lessons/:id/source  -> the downloadable-URL contract
 *   GET /asset/chunked                     -> byte-range capable video file
 *   GET /asset/norange                     -> a server that ignores Range
 * IndexedDB comes from a small in-repo shim, so the real chunk store, resume
 * logic, quota handling and budget checks run exactly as they do in a browser.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import express from 'express';
import { installFakeIndexedDB } from './helpers/fake-idb.mjs';

installFakeIndexedDB();

const { setApiBase } = await import('../src/lib/net.js');
const downloads = await import('../src/lib/downloadManager.js');
const db = await import('../src/lib/db.js');
const { releaseAllOfflinePlaybackUrls } = await import('../src/lib/media.js');

const CHUNK = 1024 * 1024;
const ASSET_SIZE = 3 * CHUNK + 333_333; // 4 chunks: three full + a ragged tail
const SLICE_DELAY_MS = 10; // slow the stream down so pause/resume is observable

const asset = Buffer.alloc(ASSET_SIZE);
for (let index = 0; index < asset.length; index += 1) {
  asset[index] = (index * 31 + 7) % 256;
}
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const assetHash = sha256(asset);

let rangeRequests = 0;
const app = express();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Streams the asset in 64 KiB pieces with real Range semantics. */
async function streamAsset(req, res, { honourRange }) {
  rangeRequests += 1;
  const header = req.headers.range;
  let start = 0;
  let end = asset.length - 1;

  if (honourRange && header) {
    const match = /bytes=(\d+)-(\d+)/.exec(header);
    if (match) {
      start = Number(match[1]);
      end = Math.min(Number(match[2]), asset.length - 1);
    }
    res.status(206);
    res.setHeader('content-range', `bytes ${start}-${end}/${asset.length}`);
  }

  const slice = asset.subarray(start, end + 1);
  res.setHeader('content-type', 'video/mp4');
  res.setHeader('content-length', slice.length);
  res.setHeader('accept-ranges', honourRange ? 'bytes' : 'none');

  for (let offset = 0; offset < slice.length; offset += 64 * 1024) {
    if (res.writableEnded || req.destroyed) return;
    res.write(slice.subarray(offset, offset + 64 * 1024));
    // eslint-disable-next-line no-await-in-loop
    await sleep(SLICE_DELAY_MS);
  }
  res.end();
}

app.get('/asset/chunked', (req, res) => streamAsset(req, res, { honourRange: true }));
app.get('/asset/norange', (req, res) => streamAsset(req, res, { honourRange: false }));
app.get('/stats', (req, res) => res.json({ rangeRequests }));

app.get('/api/tenant/:tenantId/lessons/:lessonId/source', (req, res) => {
  const base = `http://127.0.0.1:${port}`;
  const { lessonId } = req.params;

  if (lessonId === 'l-stream') {
    return res
      .status(404)
      .json({ downloadable: false, reason: 'This lesson is streaming-only for now.' });
  }
  return res.json({
    downloadable: true,
    url: `${base}/asset/${lessonId === 'l-norange' ? 'norange' : 'chunked'}`,
    mimeType: 'video/mp4',
    sizeBytes: ASSET_SIZE,
    via: 'api',
    expiresAt: Date.now() + 60_000,
  });
});

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const port = server.address().port;

setApiBase(`http://127.0.0.1:${port}`);
downloads.configure({ tenantId: 't1', capMb: 500 });
await downloads.hydrate();

const lesson = (id, extra = {}) => ({
  id,
  title: `Lesson ${id}`,
  topic: 'Test',
  durationSec: 600,
  youtubeUrl: 'https://youtu.be/M7lc1UVf-VE',
  ...extra,
});

async function waitFor(predicate, { timeoutMs = 25_000, label = 'condition' } = {}) {
  const started = Date.now();
  for (;;) {
    const value = predicate();
    if (value) return value;
    if (Date.now() - started > timeoutMs) {
      console.error(`timeout(${label}) state:`, JSON.stringify(downloads.debugSnapshot()));
      throw new Error(`Timed out waiting for ${label}`);
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(20);
  }
}

const jobOf = (key) => downloads.getSnapshot().jobs[key];
const waitForStatus = (key, status) =>
  waitFor(
    () => {
      const job = jobOf(key);
      return job && job.status === status ? job : null;
    },
    { label: `${key} -> ${status}` },
  );

const assemble = async (key) => {
  const blobs = await db.getChunkBlobs(key);
  const buffers = await Promise.all(blobs.map((blob) => blob.arrayBuffer().then(Buffer.from)));
  return Buffer.concat(buffers);
};

after(async () => {
  releaseAllOfflinePlaybackUrls();
  await db.closeDb();
  await new Promise((resolve) => server.close(resolve));
});

/* ------------------------------------------------------------------ tests */

test('a lesson is stored as 1 MiB chunks and is byte-identical to the source', async () => {
  const key = db.mediaKey('t1', 'l-full');
  const result = await downloads.enqueue(lesson('l-full'), {
    tenantId: 't1',
    courseId: 'c1',
    courseTitle: 'Physics',
  });
  assert.equal(result.ok, true);

  const job = await waitForStatus(key, 'downloaded');
  assert.equal(job.receivedBytes, ASSET_SIZE);
  assert.equal(job.totalBytes, ASSET_SIZE);
  assert.equal(job.percent, 100);

  const records = await db.getChunkRecords(key);
  assert.equal(records.length, 4, 'three full chunks plus the ragged tail');
  assert.deepEqual(
    records.map((record) => record.bytes),
    [CHUNK, CHUNK, CHUNK, 333_333],
  );
  assert.equal(sha256(await assemble(key)), assetHash);

  // Progress is persisted — this is what makes a reload resumable.
  const record = await db.getMediaRecord('t1', 'l-full');
  assert.equal(record.status, 'downloaded');
  assert.equal(record.receivedBytes, ASSET_SIZE);
  assert.equal(record.chunkCount, 4);
  assert.ok(record.downloadedAt > 0);
});

test('the snapshot reports the lesson as offline-ready', () => {
  const snapshot = downloads.getSnapshot();
  assert.equal(snapshot.downloadedCount, 1);
  assert.equal(snapshot.downloadedBytes, ASSET_SIZE);
  assert.equal(downloads.getJob('t1', 'l-full').status, 'downloaded');
});

test('pause keeps whole chunks and resume finishes byte-identically', async () => {
  const key = db.mediaKey('t1', 'l-resume');
  const result = await downloads.enqueue(lesson('l-resume'), { tenantId: 't1', courseId: 'c1' });
  assert.equal(result.ok, true);

  await waitFor(() => (jobOf(key)?.receivedBytes || 0) >= CHUNK, { label: 'first chunk' });
  downloads.pause(key);
  await waitForStatus(key, 'paused');

  const paused = jobOf(key);
  assert.equal(paused.receivedBytes % CHUNK, 0, 'stored bytes stay chunk aligned');
  assert.ok(paused.receivedBytes > 0 && paused.receivedBytes < ASSET_SIZE);
  assert.match(paused.error, /Paused/i);

  const requestsBeforeResume = rangeRequests;
  downloads.resume(key);
  const finished = await waitForStatus(key, 'downloaded');

  assert.equal(finished.receivedBytes, ASSET_SIZE);
  assert.equal(sha256(await assemble(key)), assetHash);

  // Resuming must not re-download what is already stored: 3 chunks remain.
  const requestsUsed = rangeRequests - requestsBeforeResume;
  assert.ok(requestsUsed <= 3, `resume used ${requestsUsed} requests`);
});

test('a server that ignores Range is detected and handled without corrupting the file', async () => {
  const key = db.mediaKey('t1', 'l-norange');
  const result = await downloads.enqueue(lesson('l-norange'), { tenantId: 't1', courseId: 'c1' });
  assert.equal(result.ok, true);

  const job = await waitForStatus(key, 'downloaded');
  assert.equal(job.receivedBytes, ASSET_SIZE);
  assert.equal(sha256(await assemble(key)), assetHash);
  assert.equal((await db.getChunkRecords(key)).length, 4);
});

test('a streaming-only lesson fails with an explanation and stores nothing', async () => {
  const key = db.mediaKey('t1', 'l-stream');
  const result = await downloads.enqueue(lesson('l-stream'), { tenantId: 't1', courseId: 'c1' });
  assert.equal(result.ok, true, 'it queues, then the server rejects it');

  const job = await waitForStatus(key, 'error');
  assert.match(job.error, /streaming-only/i);
  assert.equal(job.retryable, false);
  assert.equal(job.receivedBytes, 0);
  assert.equal(await db.countChunks(key), 0);
});

test('the plan cap refuses a download before any bytes are fetched', async () => {
  const usedMb = Math.floor(downloads.getSnapshot().downloadedBytes / (1024 * 1024));
  downloads.setCapMb(Math.max(1, usedMb));

  const requestsBefore = rangeRequests;
  const result = await downloads.enqueue(lesson('l-capped'), { tenantId: 't1', courseId: 'c1' });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'tenant-cap');
  assert.match(result.message, /allows \d+ MB/);
  assert.equal(rangeRequests, requestsBefore, 'a refused download makes no requests');
  assert.equal(await db.countChunks(db.mediaKey('t1', 'l-capped')), 0);

  downloads.setCapMb(500);
});

test('removing a download frees every chunk and the record', async () => {
  const key = db.mediaKey('t1', 'l-resume');
  await downloads.remove(key);

  assert.equal(await db.countChunks(key), 0);
  assert.equal(await db.getMediaRecord('t1', 'l-resume'), null);
  assert.equal(jobOf(key), undefined);
});

test('when the LMS API is unreachable the lesson asset url is used directly', async () => {
  setApiBase('http://127.0.0.1:1'); // nothing listens here
  try {
    const key = db.mediaKey('t1', 'l-direct');
    const result = await downloads.enqueue(
      lesson('l-direct', { sourceUrl: `http://127.0.0.1:${port}/asset/chunked` }),
      { tenantId: 't1', courseId: 'c1' },
    );
    assert.equal(result.ok, true);
    const job = await waitForStatus(key, 'downloaded');
    assert.equal(job.via, 'direct');
    assert.equal(sha256(await assemble(key)), assetHash);
  } finally {
    setApiBase(`http://127.0.0.1:${port}`);
  }
});

test('verifyAll() re-checks the stored chunks and reports the truth', async () => {
  const results = await downloads.verifyAll();
  const checked = results.find((entry) => entry.key === db.mediaKey('t1', 'l-full'));
  assert.equal(checked.ok, true);
  assert.equal(checked.chunks, 4);
  assert.equal(checked.expected, 4);
});

test('clearAll() empties the offline library', async () => {
  const removed = await downloads.clearAll();
  assert.ok(removed >= 3, `removed ${removed} lessons`);
  assert.equal(downloads.getSnapshot().downloadedCount, 0);
  assert.equal(downloads.getSnapshot().downloadedBytes, 0);
  assert.equal((await db.listMediaRecords('t1')).length, 0);
});

