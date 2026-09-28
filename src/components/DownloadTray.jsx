import { useApp } from '../state/AppContext.jsx';
import { JOB_STATUS, pause as pauseJob, resume as resumeJob } from '../lib/downloadManager.js';
import { formatBytes, formatSpeed } from '../lib/format.js';
import ProgressBar from './ProgressBar.jsx';

export function DownloadTray() {
  const { downloads, offline, removeDownload } = useApp();

  const active = downloads.order
    .map((key) => downloads.jobs[key])
    .filter((job) => job && job.status !== JOB_STATUS.DOWNLOADED);

  if (!active.length) return null;

  return (
    <aside className="tray" aria-label="Downloads in progress">
      <header className="tray-head">
        <strong>Downloads</strong>
        <a className="tray-link" href="#/downloads">
          Manage
        </a>
      </header>
      <ul className="tray-list">
        {active.map((job) => (
          <li key={job.key} className={`tray-item tray-${job.status}`}>
            <div className="tray-title" title={job.title}>
              {job.title}
            </div>
            {job.status === JOB_STATUS.DOWNLOADING ? (
              <>
                <ProgressBar percent={job.percent} />
                <div className="tray-meta">
                  <span>{Math.floor(job.percent)}%</span>
                  <span>{formatSpeed(job.bytesPerSecond)}</span>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => pauseJob(job.key)}>
                    Pause
                  </button>
                </div>
              </>
            ) : null}

            {job.status === JOB_STATUS.QUEUED || job.status === JOB_STATUS.FINALISING ? (
              <div className="tray-meta">
                <span>{job.status === JOB_STATUS.QUEUED ? 'Waiting in queue' : 'Finishing up…'}</span>
              </div>
            ) : null}

            {job.status === JOB_STATUS.PAUSED ? (
              <>
                <ProgressBar percent={job.percent} tone="warn" />
                <div className="tray-meta">
                  <span>{job.percent > 0 ? `${Math.floor(job.percent)}% saved` : 'Not started'}</span>
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={() => resumeJob(job.key)}
                    disabled={offline}
                  >
                    {offline ? 'Offline' : 'Resume'}
                  </button>
                </div>
                {job.error ? <p className="tray-error">{job.error}</p> : null}
              </>
            ) : null}

            {job.status === JOB_STATUS.ERROR ? (
              <>
                <p className="tray-error">{job.error}</p>
                <div className="tray-meta">
                  {job.retryable === false ? null : (
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={() => resumeJob(job.key)}
                      disabled={offline}
                    >
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
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default DownloadTray;
