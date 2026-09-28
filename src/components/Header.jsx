import { useApp } from '../state/AppContext.jsx';
import { formatBytes } from '../lib/format.js';

export function Header() {
  const { tenant, downloads, offline, simulateOffline, setSimulatedOffline, hostname } = useApp();
  const savedCount = downloads.downloadedCount;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="#/">
          <span className="brand-logo" style={{ background: tenant.brandColor }}>
            {tenant.name.slice(0, 1)}
          </span>
          <span className="brand-text">
            <strong>{tenant.name}</strong>
            <span className="muted small">{tenant.domain}</span>
          </span>
        </a>

        <nav className="nav">
          <a className="nav-link" href="#/">
            Courses
          </a>
          <a className="nav-link" href="#/downloads">
            Downloads
            {savedCount > 0 ? <span className="nav-badge">{savedCount}</span> : null}
          </a>
          <a className="nav-link" href="#/settings">
            Settings
          </a>
        </nav>

        <div className="topbar-right">
          <span className={`status-pill ${offline ? 'status-offline' : 'status-online'}`}>
            <span className="status-dot" />
            {offline ? 'Offline' : 'Online'}
          </span>
          <span className="muted small hide-sm">
            {savedCount ? `${formatBytes(downloads.downloadedBytes)} saved` : 'nothing saved yet'}
          </span>
          <label className="sim-toggle" title="Pretend the internet is gone to test offline playback">
            <input
              type="checkbox"
              checked={simulateOffline}
              onChange={(event) => setSimulatedOffline(event.target.checked)}
            />
            <span>Simulate offline</span>
          </label>
        </div>
      </div>
      <p className="muted tiny topbar-host">tenant {tenant.id} · host {hostname || 'localhost'}</p>
    </header>
  );
}

export default Header;
