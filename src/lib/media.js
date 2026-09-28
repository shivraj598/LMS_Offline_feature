/**
 * Turns stored chunks back into something a <video> element can play, and
 * captures an offline poster frame so the library still looks right with no
 * internet (the YouTube thumbnail URL is obviously unavailable offline).
 */
import { getChunkBlobs, getMediaRecord, mediaKey, touchMedia } from './db.js';

/** mediaKey -> object URL, so switching lessons does not rebuild large blobs. */
const urlCache = new Map();

export async function getOfflinePlaybackUrl(tenantId, lessonId, { touch = true } = {}) {
  const key = mediaKey(tenantId, lessonId);
  const cached = urlCache.get(key);
  if (cached) return cached;

  const record = await getMediaRecord(tenantId, lessonId);
  if (!record) return null;

  const blobs = await getChunkBlobs(key);
  if (!blobs.length) return null;

  const blob = new Blob(blobs, { type: record.mimeType || 'video/mp4' });
  const entry = { url: URL.createObjectURL(blob), size: blob.size, type: blob.type };
  urlCache.set(key, entry);
  if (touch) touchMedia(tenantId, lessonId).catch(() => {});
  return entry;
}

export function releaseOfflinePlaybackUrl(tenantId, lessonId) {
  const key = mediaKey(tenantId, lessonId);
  const cached = urlCache.get(key);
  if (!cached) return;
  URL.revokeObjectURL(cached.url);
  urlCache.delete(key);
}

export function releaseAllOfflinePlaybackUrls() {
  urlCache.forEach((entry) => URL.revokeObjectURL(entry.url));
  urlCache.clear();
}

const waitFor = (target, event, { timeoutMs = 8000 } = {}) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      resolve(ok);
    };
    const onEvent = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    target.addEventListener(event, onEvent, { once: true });
  });

/**
 * Grabs a frame from the downloaded file and returns it as a small data URL.
 * Runs fully offline (blob URL is same-origin, so the canvas is not tainted).
 * Always resolves — a null result just means "no poster".
 */
export async function capturePoster(blobUrl, { atFraction = 0.25, maxWidth = 480, quality = 0.6 } = {}) {
  if (typeof document === 'undefined' || !blobUrl) return null;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = blobUrl;

  try {
    const metaLoaded = await waitFor(video, 'loadeddata', { timeoutMs: 10000 });
    if (!metaLoaded) return null;

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    if (duration > 1) {
      const target = Math.min(duration * atFraction, duration - 0.1);
      const seeked = waitFor(video, 'seeked', { timeoutMs: 8000 });
      try {
        video.currentTime = Math.max(0.1, target);
      } catch {
        /* some codecs refuse; the first frame is fine */
      }
      await seeked;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    const scale = Math.min(1, maxWidth / width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    try {
      video.load();
    } catch {
      /* ignore */
    }
  }
}
