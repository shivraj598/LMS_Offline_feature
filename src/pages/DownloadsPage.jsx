import { useApp } from '../state/AppContext.jsx';
import { JOB_STATUS, pause as pauseJob, resume as resumeJob } from '../lib/downloadManager.js';
import { formatBytes, formatWhen } from '../lib/format.js';
import { watchHash } from '../lib/router.js';
import StorageMeter from '../components/StorageMeter.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import DownloadedBadge from '../components/DownloadedBadge.jsx';

function JobActions({ job, onRemove }) {
  if (job.status === JOB_STATUS.DOWNLOADING || job.status === JOB_STATUS.QUEUED) {
    return (
      <div className="dl-actions">
        <ProgressBar percent={job.percent} label={`Downloading ${job.title}`} />
        <span className="muted small">{Math.floor(job.percent)}%</span>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => pauseJob(job.key)}>
          Pause
        </button>
      </div>
    );
  }
  return (
    <div className="dl-actions">
      <span className="muted small">{Math.floor(job.percent)}% saved</span>
      <button type="button" className="btn btn-primary btn-xs" onClick={() => resumeJob(job.key)}>
        Resume
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={() => onRemove(job.key, job.title)}
      >
        Delete
      </button>
    </div>
  );
}

export function DownloadsPage() {
  const { courses, downloads, removeDownload, clearAllDownloads, verifyDownloads, offline } = useApp();

  const all = downloads.order.map((key) => downloads.jobs[key]).filter(Boolean);
  const saved = all.filter((job) => job.status === JOB_STATUS.DOWNLOADED);
  const pending = all.filter((job) => job.status !== JOB_STATUS.DOWNLOADED);

  const lessonHref = (job) => {
    const course = courses.find((item) => item.id === job.courseId);
    const lesson = course?.lessons.find((item) => item.id === job.lessonId);
    return course && lesson ? watchHash(course.id, lesson.id) : null;
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Offline library</h1>
          <p className="muted">
            {saved.length} lesson{saved.length === 1 ? '' : 's'} saved on this device ·{' '}
            {formatBytes(downloads.downloadedBytes)}. These play without internet.
          </p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={verifyDownloads}>
            Check files
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!all.length}
            onClick={async () => {
              if (window.confirm('Remove every offline lesson from this device?')) {
                await clearAllDownloads();
              }
            }}
          >
            Remove all
          </button>
        </div>
      </header>

      <StorageMeter detailed />

      {offline ? (
        <p className="notice-inline">
          You are offline. Downloads are paused; saved lessons below can be watched right now.
        </p>
      ) : null}

      {pending.length ? (
        <section className="block">
          <h2 className="block-title">In progress</h2>
          <ul className="dl-list">
            {pending.map((job) => (
              <li key={job.key} className="dl-item">
                <div className="dl-main">
                  <strong>{job.title}</strong>
                  <span className="muted small">
                    {job.courseTitle}
                    {job.totalBytes ? ` · ${formatBytes(job.totalBytes)}` : ''}
                  </span>
                  {job.error ? <p className="lesson-error">{job.error}</p> : null}
                </div>
                <JobActions job={job} onRemove={removeDownload} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="block">
        <h2 className="block-title">Saved lessons</h2>
        {saved.length ? (
          <ul className="dl-list">
            {saved.map((job) => {
              const href = lessonHref(job);
              return (
                <li key={job.key} className="dl-item">
                  {job.posterDataUrl ? (
                    <img className="dl-poster" src={job.posterDataUrl} alt="" />
                  ) : (
                    <span className="dl-poster dl-poster-empty" aria-hidden="true">
                      ▶
                    </span>
                  )}
                  <div className="dl-main">
                    <strong>{job.title}</strong>
                    <span className="muted small">
                      {job.courseTitle || 'Course'} · {formatBytes(job.receivedBytes)} · saved{' '}
                      {formatWhen(job.downloadedAt)}
                    </span>
                    <DownloadedBadge compact />
                  </div>
                  <div className="dl-actions">
                    {href ? (
                      <a className="btn btn-primary btn-xs" href={href}>
                        Play
                      </a>
                    ) : (
                      <span className="muted small">Lesson no longer in the catalog</span>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => removeDownload(job.key, job.title)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">
            Nothing is saved yet. Open a course and tap <strong>Download</strong> on a lesson.
          </p>
        )}
      </section>

      <section className="explainer">
        <h3>Where these files live</h3>
        <p>
          Inside this browser&apos;s private storage for this site (IndexedDB), not in the device file
          system. That is why nothing shows up in your gallery or Downloads folder, why the files
          cannot be copied out or shared, and why &quot;Remove&quot; is the way to free space. Clearing
          site data or uninstalling the browser removes them too.
        </p>
      </section>
    </div>
  );
}

export default DownloadsPage;
