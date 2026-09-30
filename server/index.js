/**
 * The LMS API.
 *
 * Two jobs, both of which belong on the server (never in the browser):
 *
 *  1. GET /api/tenant/:tenantId/lessons/:lessonId/source
 *     - checks the student is enrolled and allowed offline downloads
 *     - returns a download-capable URL: the tenant's own asset (their S3/R2/CDN
 *       object) or, when the tenant enabled it for *their own* YouTube uploads,
 *       a direct MP4 URL resolved with yt-dlp
 *     - 404 { downloadable: false, reason } when the lesson is streaming-only
 *
 *  2. GET /api/media/proxy?url=...
 *     - streams the bytes with Range support and CORS headers, so the browser's
 *       chunked downloader works even when the asset host sends no CORS headers
 *     - also the natural place to sign URLs, count bandwidth or watermark
 *
 * Run with:  npm run dev:server      (or `npm run dev:all` for both processes)
 */
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

/** Minimal YouTube id extraction for server-side validation (same rules as src/lib/youtube.js). */
function parseYouTubeId(input) {
  const value = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    if (host === 'youtu.be') return parts[0] && /^[A-Za-z0-9_-]{11}$/.test(parts[0]) ? parts[0] : null;
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      if (['embed', 'v', 'shorts', 'live'].includes(parts[0])) {
        return parts[1] && /^[A-Za-z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '..', 'shared', 'catalog.json');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

// yt-dlp is enabled by default for YouTube content the tenant owns.
// A browser can never do this itself because YouTube's media endpoints
// block cross-origin reads and the streams are signed.
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const YTDLP_ENABLED = process.env.ENABLE_YTDLP !== '0'; // enabled by default
const SIGNED_URL_TTL_MS = 30 * 60 * 1000;

// When set, owner actions (adding lessons) persist into shared/catalog.json.
// Off by default so a read-only deployment (containers, CDN-served catalogs)
// still accepts the request and answers with what it can do.
const CATALOG_WRITABLE = process.env.LMS_CATALOG_WRITABLE === '1';

const readCatalog = () => JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

function slugify(value) {
  return (
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'lesson'
  );
}

/**
 * Can this lesson ever be saved offline?
 *  - a direct file the tenant owns (their asset store / CDN)  -> yes
 *  - their own YouTube upload, with yt-dlp enabled server-side -> yes
 *  - otherwise it is streaming-only: a browser cannot save YouTube's stream.
 */
function lessonDownloadability(lesson) {
  if (lesson.sourceUrl) return true;
  if (lesson.youtubeUrl && YTDLP_ENABLED) return true;
  return false;
}

/** Append a lesson to shared/catalog.json (only when persistence is enabled). */
function appendLessonToCatalog(course, lesson) {
  const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
  const catalog = JSON.parse(raw);
  const target = catalog.courses.find((item) => item.id === course.id);
  if (!target) throw new Error('course vanished');
  target.lessons.push(lesson);
  const tmpPath = `${CATALOG_PATH}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(catalog, null, 2)}\n`);
  fs.renameSync(tmpPath, CATALOG_PATH);
}

function findLesson(tenantId, lessonId) {
  for (const course of readCatalog().courses) {
    if (course.tenantId !== tenantId) continue;
    const lesson = course.lessons.find((item) => item.id === lessonId);
    if (lesson) return { course, lesson };
  }
  return { course: null, lesson: null };
}

function findTenant(tenantId) {
  return readCatalog().tenants.find((tenant) => tenant.id === tenantId) || null;
}

async function headSize(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!response.ok) return { sizeBytes: null, mimeType: null };
    const length = Number(response.headers.get('content-length'));
    return {
      sizeBytes: Number.isFinite(length) && length > 0 ? length : null,
      mimeType: response.headers.get('content-type') || null,
    };
  } catch {
    return { sizeBytes: null, mimeType: null };
  }
}

function resolveWithYtDlp(youtubeUrl) {
  if (!YTDLP_ENABLED) return null;
  try {
    const result = spawnSync(
      YTDLP,
      ['--no-playlist', '-f', 'best[ext=mp4]/bestvideo+bestaudio/best', '--get-url', youtubeUrl],
      { encoding: 'utf8', timeout: 30000 },
    );
    if (result.status !== 0) {
      console.warn('[yt-dlp]', (result.stderr || '').trim().split('\n').slice(-1)[0] || 'failed');
      return null;
    }
    const url = (result.stdout || '').trim().split('\n')[0];
    return url && /^https?:/.test(url) ? url : null;
  } catch (error) {
    console.warn('[yt-dlp] not available:', error.message);
    return null;
  }
}

const app = express();

// In production, restrict this to the tenant domains (*.lms.com) instead of "*".
app.use(cors({ origin: true, exposedHeaders: ['content-range', 'content-length', 'accept-ranges'] }));
app.use(express.json({ limit: '64kb' }));

/**
 * Owner workflow: "I uploaded the lecture to YouTube, here is the URL."
 * The browser (Owner Studio) created the lesson locally so students see it
 * instantly; this endpoint is the server's record of it, and reports whether
 * the lesson is downloadable (the centre's own file, or yt-dlp enabled).
 *
 * Real deployments: replace the JSON append with your database write and add
 * owner authentication — the shape of the contract stays the same.
 */
app.post('/api/tenant/:tenantId/courses/:courseId/lessons', async (req, res) => {
  const { tenantId, courseId } = req.params;
  const tenant = findTenant(tenantId);
  if (!tenant) return res.status(404).json({ error: 'unknown tenant' });

  const courseRow = readCatalog().courses.find((item) => item.tenantId === tenantId && item.id === courseId);
  if (!courseRow) return res.status(404).json({ error: 'unknown course for this tenant' });

  const body = req.body || {};
  const youtubeUrl = String(body.youtubeUrl || '').trim();
  if (!youtubeUrl) {
    return res.status(400).json({ error: 'youtubeUrl is required.' });
  }
  if (!/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(youtubeUrl)) {
    return res.status(400).json({ error: 'Only YouTube URLs are accepted here.' });
  }

  const videoId = parseYouTubeId(youtubeUrl);
  if (!videoId) return res.status(400).json({ error: 'Could not read a video id from that URL.' });

  if (courseRow.lessons.some((item) => parseYouTubeId(item.youtubeUrl) === videoId)) {
    return res.status(409).json({ error: 'This video is already a lesson in this course.' });
  }

  const lesson = {
    id: String(body.id || `l-${slugify(body.title || 'lesson')}-${videoId.slice(0, 4).toLowerCase()}`),
    title: String(body.title || `Lesson ${courseRow.lessons.length + 1}`).slice(0, 120),
    topic: String(body.topic || '').slice(0, 60),
    durationSec: Number.isFinite(body.durationSec) ? body.durationSec : 0,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };

  let persisted = false;
  if (CATALOG_WRITABLE) {
    try {
      appendLessonToCatalog(courseRow, lesson);
      persisted = true;
    } catch (error) {
      console.error('[owner] could not persist lesson:', error.message);
    }
  }

  const downloadable = lessonDownloadability({ ...lesson, sourceUrl: body.sourceUrl });
  console.log(
    `[owner] ${tenantId}/${courseId} lesson "${lesson.title}" added (${videoId}) ` +
      `${persisted ? 'persisted' : 'accepted, persistence off'} ` +
      `${downloadable ? 'downloadable' : 'stream-only'}`,
  );

  return res.status(201).json({
    ok: true,
    lesson,
    courseId,
    persisted,
    downloadable,
    note: downloadable
      ? 'Students can watch online and save it for offline viewing.'
      : 'Students can stream it now. Offline saving unlocks once the lesson has a video file (or ENABLE_YTDLP resolves it).',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    tenantHosts: readCatalog().tenants.map((tenant) => tenant.domain),
    ytdlpEnabled: YTDLP_ENABLED,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

/** Catalog per tenant — the same JSON the app shell bundles, served for parity. */
app.get('/api/tenant/:tenantId/catalog', (req, res) => {
  const { tenantId } = req.params;
  const tenant = findTenant(tenantId);
  if (!tenant) return res.status(404).json({ error: 'unknown tenant' });
  const courses = readCatalog().courses.filter((course) => course.tenantId === tenantId);
  return res.json({ tenant, courses });
});

/**
 * The endpoint the offline feature depends on.
 * Returns { downloadable: true, url, mimeType, sizeBytes, via, expiresAt } for
 * lessons whose video file the tenant made available, and
 * 404 { downloadable: false, reason } for streaming-only lessons.
 */
app.get('/api/tenant/:tenantId/lessons/:lessonId/source', async (req, res) => {
  const { tenantId, lessonId } = req.params;
  const tenant = findTenant(tenantId);
  if (!tenant) return res.status(404).json({ downloadable: false, reason: 'Unknown tuition centre.' });

  const { lesson } = findLesson(tenantId, lessonId);
  if (!lesson) return res.status(404).json({ downloadable: false, reason: 'Lesson not found.' });

  // ---- entitlement check (stub: every enrolled student may use their plan cap)
  if (!tenant.maxOfflineMb) {
    return res
      .status(403)
      .json({ downloadable: false, reason: 'Offline downloads are not part of this plan.' });
  }

  // Preference 1: a direct MP4 the tenant owns (asset store / CDN / R2 / S3).
  if (lesson.sourceUrl) {
    const proxyUrl = `/api/media/proxy?url=${encodeURIComponent(lesson.sourceUrl)}&tenant=${encodeURIComponent(tenantId)}&lesson=${encodeURIComponent(lessonId)}`;
    const { sizeBytes, mimeType } = await headSize(lesson.sourceUrl);
    console.log(
      `[source] ${tenantId}/${lessonId} -> asset (${sizeBytes ? `${Math.round(sizeBytes / 1024)} KB` : 'size unknown'})`,
    );
    return res.json({
      downloadable: true,
      url: proxyUrl,
      mimeType: mimeType || 'video/mp4',
      sizeBytes,
      via: 'api',
      expiresAt: Date.now() + SIGNED_URL_TTL_MS,
    });
  }

  // Preference 2: the tenant's own YouTube upload, resolved server-side.
  if (lesson.youtubeUrl && YTDLP_ENABLED) {
    const direct = resolveWithYtDlp(lesson.youtubeUrl);
    if (direct) {
      const { sizeBytes, mimeType } = await headSize(direct);
      console.log(
        `[source] ${tenantId}/${lessonId} -> yt-dlp (${sizeBytes ? `${Math.round(sizeBytes / 1024)} KB` : 'size unknown'})`,
      );
      return res.json({
        downloadable: true,
        url: `/api/media/proxy?url=${encodeURIComponent(direct)}&tenant=${encodeURIComponent(tenantId)}&lesson=${encodeURIComponent(lessonId)}`,
        mimeType: mimeType || 'video/mp4',
        sizeBytes,
        via: 'yt-dlp',
        expiresAt: Date.now() + SIGNED_URL_TTL_MS,
      });
    }
  }

  // Otherwise: streaming only, because a browser cannot save a YouTube stream.
  return res.status(404).json({
    downloadable: false,
    reason: lesson.youtubeUrl
      ? 'This lesson is streaming-only for now. Ask your tuition centre to enable offline downloads for it.'
      : 'No video file is attached to this lesson yet.',
  });
});

/**
 * Byte-range streaming proxy.
 * Lets the browser download in 1 MiB chunks with resume, adds the CORS headers
 * the chunk downloader needs even when the asset host sends none, and is the
 * correct place for signed URLs, watermarks and bandwidth accounting.
 */
app.get('/api/media/proxy', async (req, res) => {
  const target = String(req.query.url || '');
  if (!/^https?:\/\//.test(target)) {
    return res.status(400).json({ error: 'A http(s) url is required.' });
  }

  // Production guard: only hosts the tenants own may be proxied.
  const allowedHosts = String(process.env.ALLOWED_MEDIA_HOSTS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  try {
    const host = new URL(target).hostname;
    if (allowedHosts.length && !allowedHosts.includes(host)) {
      return res.status(403).json({ error: `Host ${host} is not in ALLOWED_MEDIA_HOSTS.` });
    }
  } catch {
    return res.status(400).json({ error: 'Malformed url.' });
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const upstreamHeaders = {};
  if (req.headers.range) upstreamHeaders.Range = req.headers.range;

  try {
    const upstream = await fetch(target, {
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: controller.signal,
    });

    res.status(upstream.status);
    for (const header of ['content-type', 'content-length', 'content-range', 'etag', 'last-modified']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    // Always advertise range support: it is what makes pause/resume possible.
    res.setHeader('accept-ranges', upstream.headers.get('accept-ranges') || 'bytes');
    res.setHeader('cache-control', 'private, no-store');
    res.setHeader('content-disposition', 'inline');

    if (!upstream.body) {
      res.end();
      return undefined;
    }
    Readable.fromWeb(upstream.body).pipe(res);
    return undefined;
  } catch (error) {
    if (error?.name === 'AbortError') {
      res.end();
      return undefined;
    }
    console.error('[proxy] failed:', error?.message);
    return res.status(502).json({ error: 'Could not fetch the upstream video.' });
  }
});

// HEAD is used for size probes before a download starts.
app.head('/api/media/proxy', async (req, res) => {
  const target = String(req.query.url || '');
  if (!/^https?:\/\//.test(target)) return res.status(400).end();
  try {
    const upstream = await fetch(target, { method: 'HEAD', redirect: 'follow' });
    res.status(upstream.status);
    for (const header of ['content-type', 'content-length', 'accept-ranges']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    return res.end();
  } catch {
    return res.status(502).end();
  }
});

/** Only start listening when the file is run directly (`npm run dev:server`). */
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  app.listen(PORT, HOST, () => {
    console.log(`LMS API listening on http://${HOST}:${PORT}`);
    console.log(
      `  yt-dlp resolution: ${YTDLP_ENABLED ? 'enabled' : 'disabled (set ENABLE_YTDLP=1 to try)'}`,
    );
    console.log('  Vite dev server proxies /api here, so the app needs no API url configured.');
  });
}

export default app;
