/**
 * Lesson thumbnail.
 *
 * Online: the YouTube poster frame of the lesson's video.
 * Downloaded: the poster frame captured from the *local* file, so the library
 * still shows real thumbnails with no internet at all.
 */
import { useState } from 'react';
import { youtubeThumbnail } from '../lib/youtube.js';
import { formatDuration } from '../lib/format.js';

export function Thumb({ lesson, job, width = 168 }) {
  const [broken, setBroken] = useState(false);
  const poster = job?.posterDataUrl || null;
  const remote = youtubeThumbnail(lesson.youtubeUrl, 'hq');
  const src = poster || remote;

  return (
    <div className="thumb" style={{ width }}>
      {src && !broken ? (
        <img
          className="thumb-img"
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="thumb-fallback" aria-hidden="true">
          <span>▶</span>
        </div>
      )}
      {lesson.durationSec ? (
        <span className="thumb-duration">{formatDuration(lesson.durationSec)}</span>
      ) : null}
      {job?.status === 'downloaded' ? (
        <span className="thumb-offline" title="Saved on this device">
          ⤓
        </span>
      ) : null}
    </div>
  );
}

export default Thumb;
