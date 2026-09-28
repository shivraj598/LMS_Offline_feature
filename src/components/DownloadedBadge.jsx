/**
 * The badge the whole feature is about: this lesson is on the device and plays
 * with no internet. If a stored poster frame exists we can show the visual proof
 * (sizes/dates come from IndexedDB, nothing was touched on the device).
 */
import { formatBytes, formatWhen } from '../lib/format.js';

export function DownloadedBadge({ size, when, compact = false }) {
  return (
    <span className={`chip chip-done ${compact ? 'chip-compact' : ''}`} title="Saved inside the app for offline viewing">
      <span aria-hidden="true">⤓</span>
      Downloaded
      {Number.isFinite(size) && size > 0 ? <span className="chip-info">· {formatBytes(size)}</span> : null}
      {when && !compact ? <span className="chip-info">· {formatWhen(when)}</span> : null}
    </span>
  );
}

export default DownloadedBadge;
