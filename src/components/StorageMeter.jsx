/** Storage meter: how much of the device / plan budget the offline library uses. */
import { useApp } from '../state/AppContext.jsx';
import { formatBytes } from '../lib/format.js';
import ProgressBar from './ProgressBar.jsx';

export function StorageMeter({ detailed = false }) {
  const { downloads, tenant, askPersistentStorage } = useApp();
  const { storage, downloadedBytes, downloadedCount } = downloads;

  const capBytes = tenant.maxOfflineMb ? tenant.maxOfflineMb * 1024 * 1024 : null;
  const quota = storage.quota || 0;
  const denominator = Math.min(
    ...[capBytes ?? Number.POSITIVE_INFINITY, quota || Number.POSITIVE_INFINITY].filter(Number.isFinite),
  );
  const percent = denominator > 0 && Number.isFinite(denominator) ? (downloadedBytes / denominator) * 100 : 0;

  return (
    <section className="storage-meter">
      <div className="spread">
        <strong>Offline library</strong>
        <span className="muted">
          {downloadedCount} lesson{downloadedCount === 1 ? '' : 's'} · {formatBytes(downloadedBytes)}
        </span>
      </div>
      <ProgressBar
        percent={percent}
        tone={percent > 85 ? 'warn' : 'accent'}
        height={8}
        label="Offline storage used"
      />
      <p className="muted small">
        {Number.isFinite(denominator)
          ? `${formatBytes(downloadedBytes)} of ${formatBytes(denominator)} allowed${
              storage.quota ? ` (browser quota ${formatBytes(quota)})` : ''
            }`
          : 'Browser quota is not reported by this browser.'}
      </p>
      {detailed ? (
        <div className="storage-notes">
          <p>
            Videos are kept in this browser&apos;s private storage for {tenant.domain}. They are not
            downloaded to your gallery or file manager, cannot be shared, and are removed when you
            clear site data.
          </p>
          <p>
            {storage.persisted
              ? 'Storage is persistent: the browser will not clear these downloads on its own.'
              : 'Storage is best-effort: the browser may clear downloads if the device runs low on space.'}
          </p>
          {storage.persisted ? null : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={askPersistentStorage}>
              Protect my downloads
            </button>
          )}
          <p className="muted small">
            Plan limit for {tenant.name}: {tenant.maxOfflineMb} MB per student. Storage used by the
            browser is {formatBytes(storage.usage)}.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default StorageMeter;
