/** Thin progress bar used by lesson rows, the tray and the storage meter. */
export function ProgressBar({ percent = 0, tone = 'accent', height = 6, label }) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div
      className={`progress progress-${tone}`}
      style={{ height }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label || 'Download progress'}
    >
      <div className="progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export default ProgressBar;
