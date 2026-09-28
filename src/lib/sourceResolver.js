/**
 * Where does the downloadable file come from?
 *
 * The browser cannot pull bytes out of a YouTube iframe, so the LMS backend is
 * asked first: it checks the student's entitlement, then hands back a
 * download-capable URL for the tenant's own asset (their uploaded MP4, their
 * asset store, or their own YouTube upload resolved with yt-dlp on the server).
 *
 * Order of preference:
 *   1. GET /api/tenant/:tenantId/lessons/:lessonId/source   (signed URL, audited)
 *   2. the lesson's own asset URL, if the API is unreachable (dev / demo)
 *   3. not downloadable -> the UI explains why and offers online streaming only
 */
import { netFetch, OfflineError, isOffline } from './net.js';

export class NotDownloadableError extends Error {
  constructor(message, code = 'not-downloadable') {
    super(message);
    this.name = 'NotDownloadableError';
    this.code = code;
  }
}

export class DownloadError extends Error {
  constructor(message, { retryable = true, code = 'download-failed' } = {}) {
    super(message);
    this.name = 'DownloadError';
    this.code = code;
    this.retryable = retryable;
  }
}

const STREAM_ONLY_MESSAGE =
  'This lesson is streaming-only right now, so it cannot be saved offline. Ask your tuition centre to attach the video file (or enable offline downloads) for this lesson.';

export async function resolveLessonSource(lesson, { tenantId } = {}) {
  if (!lesson?.id) throw new NotDownloadableError('Unknown lesson.');

  const endpoint = `/api/tenant/${encodeURIComponent(tenantId)}/lessons/${encodeURIComponent(lesson.id)}/source`;

  // Genuinely offline: let the manager park the job until there is internet.
  if (isOffline()) throw new OfflineError();

  try {
    const response = await netFetch(endpoint, { headers: { accept: 'application/json' } });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data?.downloadable && data.url) {
        return {
          url: data.url,
          mimeType: data.mimeType || 'video/mp4',
          sizeBytes: Number.isFinite(data.sizeBytes) ? data.sizeBytes : null,
          via: data.via || 'api',
          expiresAt: data.expiresAt ?? null,
        };
      }
      throw new NotDownloadableError(data?.reason || STREAM_ONLY_MESSAGE, 'stream-only');
    }

    if (response.status === 404 || response.status === 403) {
      const data = await response.json().catch(() => null);
      throw new NotDownloadableError(
        data?.reason ||
          (response.status === 403
            ? 'Your enrolment does not allow offline downloads for this lesson.'
            : STREAM_ONLY_MESSAGE),
        response.status === 403 ? 'not-entitled' : 'stream-only',
      );
    }
    // 5xx: the API answered but is broken — fall through to the asset URL.
  } catch (error) {
    if (error instanceof NotDownloadableError) throw error;
    if (error instanceof OfflineError) {
      // The network is reachable but the classroom API did not answer. If the
      // lesson carries its own asset URL we can still serve the student.
      if (lesson.sourceUrl) {
        return { url: lesson.sourceUrl, mimeType: 'video/mp4', sizeBytes: null, via: 'direct', expiresAt: null };
      }
      throw new DownloadError(
        "We could not reach your tuition centre's server. Check your connection and try again.",
        { retryable: true, code: 'api-unreachable' },
      );
    }
    throw error;
  }

  if (lesson.sourceUrl) {
    return { url: lesson.sourceUrl, mimeType: 'video/mp4', sizeBytes: null, via: 'direct', expiresAt: null };
  }

  throw new NotDownloadableError(STREAM_ONLY_MESSAGE, 'stream-only');
}

/** Best-effort size probe so the UI can warn before a big download. */
export async function probeSize(url, { timeoutMs = 6000 } = {}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await netFetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const length = Number(response.headers.get('content-length'));
    return Number.isFinite(length) && length > 0 ? length : null;
  } catch {
    return null;
  }
}
