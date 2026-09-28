/**
 * Lesson player.
 *
 * Two very different playback paths, which is the honest reality of an LMS built
 * on YouTube links:
 *   - stream : YouTube iframe (needs internet, cannot be saved offline)
 *   - offline: the student's own downloaded copy, played from a local blob
 *
 * When both exist the offline copy wins by default: instant, no data use, and it
 * is the only one that works on a bus with no signal.
 */
import { useEffect, useMemo, useState } from 'react';
import { useApp, statusLabel } from '../state/AppContext.jsx';
import { JOB_STATUS, markAccessed } from '../lib/downloadManager.js';
import { getOfflinePlaybackUrl } from '../lib/media.js';
import { youtubeEmbedUrl, youtubeWatchUrl } from '../lib/youtube.js';
import { watchHash } from '../lib/router.js';
import { formatBytes, formatDuration } from '../lib/format.js';
import DownloadButton from './DownloadButton.jsx';
import ProgressBar from './ProgressBar.jsx';

export function LessonPlayer({ course, lesson }) {
  const { tenantId, offline, jobFor, downloads, removeDownload } = useApp();
  const job = jobFor(lesson);
  const downloaded = job?.status === JOB_STATUS.DOWNLOADED;
  const [mode, setMode] = useState(null); // null = decide automatically
  const [offlineUrl, setOfflineUrl] = useState(null);
  const [preparing, setPreparing] = useState(false);

  const effectiveMode = mode ?? (downloaded ? 'offline' : 'stream');
  const status = statusLabel(job);

  useEffect(() => {
    let cancelled = false;
    if (effectiveMode !== 'offline' || !downloaded) {
      setOfflineUrl(null);
      return () => {};
    }
    setPreparing(true);
    getOfflinePlaybackUrl(tenantId, lesson.id)
      .then((entry) => {
        if (cancelled) return;
        setOfflineUrl(entry?.url || null);
        if (entry?.url) markAccessed(tenantId, lesson.id);
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveMode, downloaded, tenantId, lesson.id]);

  const embedUrl = useMemo(() => youtubeEmbedUrl(lesson.youtubeUrl), [lesson.youtubeUrl]);
  const watchUrl = useMemo(() => youtubeWatchUrl(lesson.youtubeUrl), [lesson.youtubeUrl]);

  const savedLessons = downloads.order
    .map((key) => downloads.jobs[key])
    .filter((item) => item?.status === JOB_STATUS.DOWNLOADED && item.courseId);

  return (
    <div className="player-wrap">
      <div className="player-head">
        <h2>{lesson.title}</h2>
        <div className="lesson-sub">
          {lesson.topic ? <span className="tag">{lesson.topic}</span> : null}
          <span className="muted">{formatDuration(lesson.durationSec)}</span>
          <span className={`row-status row-status-${status.tone}`}>{status.text}</span>
          {downloaded && job.receivedBytes ? (
            <span className="muted small">{formatBytes(job.receivedBytes)} saved</span>
          ) : null}
        </div>
      </div>

      <div className="player-area">
        {effectiveMode === 'offline' && downloaded ? (
          preparing && !offlineUrl ? (
            <div className="player-placeholder">
              <p>Preparing the offline copy…</p>
            </div>
          ) : offlineUrl ? (
            <video
              className="video-el"
              src={offlineUrl}
              poster={job?.posterDataUrl || undefined}
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="player-placeholder">
              <p>This download looks incomplete. Tap resume to repair it.</p>
            </div>
          )
        ) : offline ? (
          <div className="player-placeholder">
            <h3>Not available offline</h3>
            <p>
              This lesson is not saved on this device, and YouTube streaming needs an internet
              connection. Save lessons before you travel so they are here next time.
            </p>
            {savedLessons.length ? (
              <div className="offline-picks">
                <span className="muted small">Saved on this device:</span>
                {savedLessons.map((item) => (
                  <a
                    key={item.key}
                    className="btn btn-ghost btn-sm"
                    href={watchHash(item.courseId, item.lessonId)}
                  >
                    {item.title}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : embedUrl ? (
          <iframe
            className="video-el"
            src={embedUrl}
            title={lesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="player-placeholder">
            <p>No playable source is attached to this lesson yet.</p>
          </div>
        )}
      </div>

      <div className="player-controls">
        {downloaded ? (
          <div className="segmented" role="group" aria-label="Playback source">
            <button
              type="button"
              className={effectiveMode === 'offline' ? 'segmented-on' : ''}
              onClick={() => setMode('offline')}
            >
              Offline copy
            </button>
            <button
              type="button"
              className={effectiveMode === 'stream' ? 'segmented-on' : ''}
              onClick={() => setMode('stream')}
              disabled={offline}
              title={offline ? 'Streaming needs internet' : 'Stream from YouTube'}
            >
              YouTube
            </button>
          </div>
        ) : null}

        <DownloadButton lesson={lesson} course={course} />

        {downloaded ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => removeDownload(job.key, job.title)}
          >
            Remove download
          </button>
        ) : watchUrl ? (
          <a className="btn btn-ghost btn-sm" href={watchUrl} target="_blank" rel="noreferrer">
            Open on YouTube
          </a>
        ) : null}
      </div>

      {job && !downloaded && job.status !== JOB_STATUS.ERROR ? (
        <div className="player-progress">
          <ProgressBar percent={job.percent} label="Download progress for this lesson" />
          <span className="muted small">
            {Math.floor(job.percent)}% saved for offline
            {job.totalBytes
              ? ` · ${formatBytes(job.receivedBytes || 0)} / ${formatBytes(job.totalBytes)}`
              : ''}
          </span>
        </div>
      ) : null}

      {job?.status === JOB_STATUS.ERROR ? <p className="lesson-error">{job.error}</p> : null}

      {downloaded ? (
        <p className="muted small">
          Playing from the copy stored inside this app. It stays available with no internet and does
          not appear in your device&apos;s files or gallery.
        </p>
      ) : lesson.sourceUrl ? null : (
        <p className="muted small">
          This lesson currently streams from YouTube only. Ask your tuition centre to attach the
          lesson file to make offline downloads available for it.
        </p>
      )}
    </div>
  );
}

export default LessonPlayer;
