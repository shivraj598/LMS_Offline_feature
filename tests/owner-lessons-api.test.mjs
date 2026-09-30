/**
 * Owner workflow tests: the "paste a YouTube URL" endpoint.
 *
 * The browser creates the lesson locally (Owner Studio) and POSTs it here.
 * These tests pin the server's contract:
 *   - only YouTube URLs are accepted (400 for anything else)
 *   - duplicates in the same course are rejected (409)
 *   - unknown tenant/course 404
 *   - the response says whether the lesson is downloadable (stream-only when
 *     the centre has no file for it and yt-dlp resolution is disabled)
 *   - persistence stays off unless LMS_CATALOG_WRITABLE=1, so the bundled
 *     catalog is never mutated by a test run
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.ENABLE_YTDLP = '0'; // deterministic: no yt-dlp on CI machines

const { default: app } = await import('../server/index.js');

const CATALOG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'shared',
  'catalog.json',
);

let server;
let base;
let catalogBefore;

before(async () => {
  catalogBefore = fs.readFileSync(CATALOG_PATH, 'utf8');
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  // The endpoint must not mutate the bundled catalog when persistence is off.
  assert.equal(fs.readFileSync(CATALOG_PATH, 'utf8'), catalogBefore);
});

const post = (tenantId, courseId, body) =>
  fetch(`${base}/api/tenant/${tenantId}/courses/${courseId}/lessons`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('a valid YouTube URL becomes a lesson and reports stream-only status', async () => {
  const response = await post('tuitioncentre1', 'c-physics-12', {
    id: 'l-owner-test',
    title: 'Friction - Board Questions',
    youtubeUrl: 'https://www.youtube.com/watch?v=zABCDEF1234',
  });
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.lesson.youtubeUrl, 'https://www.youtube.com/watch?v=zABCDEF1234');
  assert.equal(data.lesson.title, 'Friction - Board Questions');
  assert.equal(data.persisted, false, 'persistence stays off without LMS_CATALOG_WRITABLE');
  assert.equal(data.downloadable, false, 'youtube-only lesson is streaming-only with yt-dlp off');
  assert.match(data.note, /stream|offline/i);
});

test('shorts and youtu.be URLs are normalised to watch URLs', async () => {
  const shorts = await post('tuitioncentre1', 'c-physics-12', {
    title: 'Shorts shape',
    youtubeUrl: 'https://www.youtube.com/shorts/zABCDEF1235',
  });
  assert.equal(shorts.status, 201);
  assert.equal((await shorts.json()).lesson.youtubeUrl, 'https://www.youtube.com/watch?v=zABCDEF1235');

  const youtuBe = await post('tuitioncentre1', 'c-physics-12', {
    title: 'Short link shape',
    youtubeUrl: 'https://youtu.be/zABCDEF1236',
  });
  assert.equal(youtuBe.status, 201);
  assert.equal((await youtuBe.json()).lesson.youtubeUrl, 'https://www.youtube.com/watch?v=zABCDEF1236');
});

test('a lesson with a sourceUrl reports downloadable', async () => {
  const response = await post('tuitioncentre1', 'c-physics-12', {
    title: 'With file',
    youtubeUrl: 'https://youtu.be/zABCDEF1237',
    sourceUrl: 'https://cdn.example.com/lesson.mp4',
  });
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.downloadable, true);
  assert.match(data.note, /offline/i);
});

test('non-YouTube URLs and missing URLs are rejected', async () => {
  const vimeo = await post('tuitioncentre1', 'c-physics-12', {
    title: 'Not YouTube',
    youtubeUrl: 'https://vimeo.com/123456789',
  });
  assert.equal(vimeo.status, 400);
  assert.match((await vimeo.json()).error, /YouTube/i);

  const garbage = await post('tuitioncentre1', 'c-physics-12', {
    title: 'Broken id',
    youtubeUrl: 'https://www.youtube.com/watch?v=too-short',
  });
  assert.equal(garbage.status, 400);

  const empty = await post('tuitioncentre1', 'c-physics-12', { title: 'No url' });
  assert.equal(empty.status, 400);
});

test('duplicate videos in the same course are rejected with 409', async () => {
  // M7lc1UVf-VE is already a lesson (l-newton-laws) in c-physics-12.
  const response = await post('tuitioncentre1', 'c-physics-12', {
    title: 'Same video again',
    youtubeUrl: 'https://youtu.be/M7lc1UVf-VE',
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /already/i);
});

test('the same video in a different course is fine', async () => {
  const response = await post('tuitioncentre1', 'c-maths-11', {
    title: 'Reused elsewhere',
    youtubeUrl: 'https://youtu.be/M7lc1UVf-VE',
  });
  assert.equal(response.status, 201);
});

test('unknown tenants and courses 404', async () => {
  const badCourse = await post('tuitioncentre1', 'c-nope', {
    youtubeUrl: 'https://youtu.be/zABCDEF1238',
  });
  assert.equal(badCourse.status, 404);

  const badTenant = await post('nope', 'c-physics-12', {
    youtubeUrl: 'https://youtu.be/zABCDEF1238',
  });
  assert.equal(badTenant.status, 404);
});
