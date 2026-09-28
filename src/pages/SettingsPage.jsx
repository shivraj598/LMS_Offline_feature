import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { getPrefs, savePrefs } from '../lib/db.js';
import { setCapMb } from '../lib/downloadManager.js';
import { formatBytes, formatMbValue } from '../lib/format.js';
import StorageMeter from '../components/StorageMeter.jsx';

export function SettingsPage() {
  const {
    tenant,
    tenantId,
    hostname,
    downloads,
    offline,
    simulateOffline,
    setSimulatedOffline,
    clearAllDownloads,
    verifyDownloads,
  } = useApp();

  const planCap = tenant.maxOfflineMb;
  const [cap, setCap] = useState(planCap);
  const [swReady, setSwReady] = useState(false);

  // Load the student's own (lower) cap if they set one earlier.
  useEffect(() => {
    getPrefs()
      .then((prefs) => {
        if (Number.isFinite(prefs?.capMb) && prefs.capMb > 0) {
          const bounded = Math.min(prefs.capMb, planCap);
          setCap(bounded);
          setCapMb(bounded);
        }
      })
      .catch(() => {});
  }, [planCap]);

  useEffect(() => {
    const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    setSwReady(Boolean(supported && navigator.serviceWorker.controller));
  }, []);

  const applyCap = async (value) => {
    const bounded = Math.max(50, Math.min(value, planCap));
    setCap(bounded);
    setCapMb(bounded);
    await savePrefs({ capMb: bounded }).catch(() => {});
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">
            {tenant.name} ({tenantId}) · plan {tenant.plan} · host {hostname || 'localhost'}
          </p>
        </div>
      </header>

      <StorageMeter detailed />

      <section className="block">
        <h2 className="block-title">Offline storage limit</h2>
        <p className="muted small">
          Your plan allows up to {planCap} MB of offline videos per student. You can keep a smaller
          library for yourself.
        </p>
        <label className="field">
          <span>My limit: {formatMbValue(cap)}</span>
          <input
            type="range"
            min={50}
            max={planCap}
            step={50}
            value={cap}
            onChange={(event) => applyCap(Number(event.target.value))}
          />
        </label>
        <p className="muted small">
          Currently saved: {formatBytes(downloads.downloadedBytes)}. Downloads that would exceed the
          limit are refused before they start, so a student never fills their phone by accident.
        </p>
      </section>

      <section className="block">
        <h2 className="block-title">Offline mode</h2>
        <p className="muted small">
          The app shell is cached by a service worker, so this site opens with no network at all. Use
          the switch below (or turn off Wi-Fi) and open a lesson you downloaded.
        </p>
        <div className="kv">
          <span>Network</span>
          <span className={offline ? 'chip chip-error' : 'chip chip-done'}>{offline ? 'Offline' : 'Online'}</span>
        </div>
        <div className="kv">
          <span>App shell cached</span>
          <span className={swReady ? 'chip chip-done' : 'chip chip-busy'}>
            {swReady ? 'Yes (service worker active)' : 'Not yet — run a production build or reload once'}
          </span>
        </div>
        <label className="sim-toggle sim-toggle-block">
          <input
            type="checkbox"
            checked={simulateOffline}
            onChange={(event) => setSimulatedOffline(event.target.checked)}
          />
          <span>Simulate offline mode</span>
        </label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={verifyDownloads}>
          Verify downloaded files
        </button>
      </section>

      <section className="block">
        <h2 className="block-title">Danger zone</h2>
        <p className="muted small">
          Removing downloads deletes the stored video chunks immediately and cannot be undone.
        </p>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={!downloads.order.length}
          onClick={async () => {
            if (window.confirm('Delete all offline lessons from this device?')) {
              await clearAllDownloads();
            }
          }}
        >
          Remove all offline lessons
        </button>
      </section>

      <section className="explainer">
        <h3>Why not just download the file?</h3>
        <p>
          A normal download lands in the device&apos;s storage, where it can be copied, shared or
          uploaded anywhere. A tuition centre&apos;s paid content is usually not allowed to leave the
          app like that. Keeping the video in the browser&apos;s private storage for this site gives
          the student the same convenience — watch later, zero data, works on a bus with no signal —
          while the lesson stays inside the LMS and is removed when the download is removed.
        </p>
        <p>
          Lessons hosted only as YouTube links cannot be saved by a browser: YouTube does not allow
          it, and the streams are signed. Offline downloads work for lessons where the tuition centre
          has attached the video file (their own upload or asset store), which the LMS API hands out
          per student with a signed, expiring URL.
        </p>
      </section>
    </div>
  );
}

export default SettingsPage;
