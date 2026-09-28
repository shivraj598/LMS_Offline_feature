/**
 * The single control a student uses for one lesson:
 * Save offline -> Downloading (pause) -> Paused (resume) -> Downloaded (remove).
 */
import { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { JOB_STATUS, pause as pauseJob, resume as resumeJob } from '../lib/downloadManager.js';
import { formatBytes } from '../lib/format.js';
import ProgressBar from './ProgressBar.jsx';
import DownloadedBadge from './DownloadedBadge.jsx';

export function DownloadButton({ lesson, course, compact = false }) {
  const { jobFor, downloadLesson, offline, removeDownload } = useApp();
  const [busy, setBusy] = useState(false);
  const job = jobFor(lesson);

  const start = async () => {
    setBusy(true);
    try {
      await downloadLesson(lesson, course);
    } finally {
      setBusy(false);
    }
  };

  if (!job) {
    return (
      <button
        type="button"
        className={`btn ${compact ? 'btn-sm' : ''} btn-primary`}
        onClick={start}
        disabled={busy || offline}
        title={offline ? 'Connect to the internet to download this lesson' : 'Save this lesson inside the app for offline viewing'}
      >
        {offline ? 'Offline' : busy ? 'Starting…' : 'Download'}
      </button>
    );
  }

  if (job.status === JOB_STATUS.DOWNLOADED) {
    return (
      <div className="dl-done">
        <DownloadedBadge size={job.receivedBytes} />
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => removeDownload(job.key, job.title)}
          title="Remove from this device to free storage"
        >
          Remove
        </button>
      </div>
    );
  }

  if (job.status === JOB_STATUS.QUEUED || job.status === JOB_STATUS.FINALISING) {
    return (
      <div className="dl-active">
        <span className="chip chip-busy">
          {job.status === JOB_STATUS.QUEUED ? 'Queued' : 'Finishing…'}
        </span>
      </div>
    );
  }

  if (job.status === JOB_STATUS.DOWNLOADING) {
    return (
      <div className="dl-active">
        <div className="dl-progress">
          <ProgressBar percent={job.percent} label={`Downloading ${lesson.title}`} />
          <span className="dl-progress-text">
            {Math.floor(job.percent)}%
            {job.totalBytes ? ` · ${formatBytes(job.receivedBytes)} / ${formatBytes(job.totalBytes)}` : ''}
          </span>
        </div>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => pauseJob(job.key)}>
          Pause
        </button>
      </div>
    );
  }

  if (job.status === JOB_STATUS.PAUSED) {
    return (
      <div className="dl-active">
        <div className="dl-progress">
          <ProgressBar percent={job.percent} tone="warn" label={`Paused at ${Math.floor(job.percent)}%`} />
          <span className="dl-progress-text">
            {Math.floor(job.percent)}% saved
            {job.totalBytes ? ` of ${formatBytes(job.totalBytes)}` : ''}
          </span>
        </div>
        <button type="button" className="btn btn-primary btn-xs" onClick={resume} disabled={offline}>
          {offline ? 'Waiting for internet' : 'Resume'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => removeDownload(job.key, job.title)}
          title="Delete the partial download"
        >
          Delete
        </button>
      </div>
    );
  }

  // error
  return (
    <div className="dl-active dl-error">
      <span className="chip chip-error" title={job.error || 'Download failed'}>
        Failed
      </span>
      {job.retryable === false ? null : (
        <button type="button" className="btn btn-primary btn-xs" onClick={resume} disabled={offline}>
          Retry
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={() => removeDownload(job.key, job.title)}
      >
        Dismiss
      </button>
    </div>
  );
}

export default DownloadButton;
