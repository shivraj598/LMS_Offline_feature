/**
 * YouTube URL helpers (pure, unit tested).
 *
 * Important product note: a browser cannot download an iframe/stream from
 * YouTube (no CORS on the media endpoints, signed URLs, and it breaks YouTube's
 * Terms of Service). So a lesson is either
 *   - streamable  : played in the YouTube iframe, online only, or
 *   - downloadable: the tenant's own MP4 (their upload / asset store) which we
 *     can fetch and keep in app-private storage for offline playback.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Extract an 11-char video id from any common YouTube URL shape. */
export function parseYoutubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim();

  if (ID_PATTERN.test(value)) return value;

  let url;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return parts[0] && ID_PATTERN.test(parts[0]) ? parts[0] : null;
  }

  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const v = url.searchParams.get('v');
    if (v && ID_PATTERN.test(v)) return v;
    if (parts[0] === 'embed' || parts[0] === 'v' || parts[0] === 'shorts' || parts[0] === 'live') {
      return parts[1] && ID_PATTERN.test(parts[1]) ? parts[1] : null;
    }
  }

  return null;
}

/** Thumbnail URL; `file` can be default | mq | hq | sd | maxres. */
export function youtubeThumbnail(youtubeUrlOrId, file = 'hq') {
  const id = parseYoutubeId(youtubeUrlOrId);
  if (!id) return null;
  const suffix = file === 'hq' ? 'hqdefault' : file === 'mq' ? 'mqdefault' : `${file}default`;
  return `https://i.ytimg.com/vi/${id}/${suffix}.jpg`;
}

/** Privacy-friendly embed URL (youtube-nocookie) with a sane player config. */
export function youtubeEmbedUrl(youtubeUrlOrId, { autoplay = false, startSeconds = 0 } = {}) {
  const id = parseYoutubeId(youtubeUrlOrId);
  if (!id) return null;
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
  });
  if (autoplay) params.set('autoplay', '1');
  if (startSeconds > 0) params.set('start', String(Math.floor(startSeconds)));
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

/** Stable watch link, used for the "open on YouTube" fallback action. */
export function youtubeWatchUrl(youtubeUrlOrId) {
  const id = parseYoutubeId(youtubeUrlOrId);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
