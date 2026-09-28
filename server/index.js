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

const readCatalog = () => JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

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
