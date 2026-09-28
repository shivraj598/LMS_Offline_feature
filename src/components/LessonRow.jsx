import { useApp, statusLabel } from '../state/AppContext.jsx';
import { formatBytes, formatDuration } from '../lib/format.js';
import { watchHash } from '../lib/router.js';
import Thumb from './Thumb.jsx';
import DownloadButton from './DownloadButton.jsx';
import { JOB_STATUS } from '../lib/downloadManager.js';

export function LessonRow({ lesson, course, index }) {
  const { jobFor } = useApp();
  const job = jobFor(lesson);
  const status = statusLabel(job);
  const downloaded = job?.status === JOB_STATUS.DOWNLOADED;

  return (
    <li className={`lesson-row ${downloaded ? 'lesson-downloaded' : ''}`}>
      <a className="lesson-thumb-link" href={watchHash(course.id, lesson.id)} aria-label={`Open ${lesson.title}`}>
        <Thumb lesson={lesson} job={job} />
      </a>

      <div className="lesson-main">
        <a className="lesson-title" href={watchHash(course.id, lesson.id)}>
          {index !== undefined ? <span className="lesson-index">{index + 1}.</span> : null} {lesson.title}
        </a>
        <div className="lesson-sub">
          {lesson.topic ? <span className="tag">{lesson.topic}</span> : null}
          <span className="muted">{formatDuration(lesson.durationSec)}</span>
          {downloaded ? (
            <span className="muted small">
              {formatBytes(job.receivedBytes)} on this device
              {job.posterDataUrl ? ' · thumbnail cached' : ''}
            </span>
          ) : (
            <span className="muted small">{lesson.sourceUrl ? 'downloadable' : 'streaming only'}</span>
          )}
        </div>
        {job?.status === JOB_STATUS.ERROR && job.error ? (
          <p className="lesson-error">{job.error}</p>
        ) : null}
        {job?.status === JOB_STATUS.PAUSED && job.error ? (
          <p className="lesson-note">{job.error}</p>
        ) : null}
        <span className={`row-status row-status-${status.tone}`}>{status.text}</span>
      </div>

      <div className="lesson-actions">
        <DownloadButton lesson={lesson} course={course} compact />
        <a className="btn btn-ghost btn-sm" href={watchHash(course.id, lesson.id)}>
          Watch
        </a>
      </div>
    </li>
  );
}

export default LessonRow;
