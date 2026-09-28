/** Toast stack — every background result gets a plain-language explanation. */
import { useApp } from '../state/AppContext.jsx';

export function Notices() {
  const { notices, dismissNotice } = useApp();
  if (!notices.length) return null;

  return (
    <div className="notices" aria-live="polite">
      {notices.map((notice) => (
        <div key={notice.id} className={`notice notice-${notice.tone || 'info'}`}>
          <p>{notice.message}</p>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => dismissNotice(notice.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default Notices;
