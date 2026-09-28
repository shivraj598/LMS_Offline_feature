/** Connectivity banner: the app keeps working, so say exactly what still works. */
import { useApp } from '../state/AppContext.jsx';
import { isForcedOffline } from '../lib/net.js';

export function OfflineBanner({ savedCount }) {
  const { offline } = useApp();
  if (!offline) return null;

  const simulated = isForcedOffline();

  return (
    <div className={`offline-banner ${simulated ? 'offline-banner-sim' : ''}`} role="status">
      <strong>{simulated ? 'Offline mode (simulated)' : 'You are offline'}</strong>
      <span>
        {savedCount > 0
          ? `${savedCount} lesson${savedCount === 1 ? '' : 's'} on this device will still play.`
          : 'No lessons are saved on this device yet.'}
      </span>
      <a className="tray-link" href="#/downloads">
        Open offline library
      </a>
    </div>
  );
}

export default OfflineBanner;
