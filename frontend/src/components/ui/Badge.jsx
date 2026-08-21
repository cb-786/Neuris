/** Compact status/label token. `tone` maps to the semantic colour set. */
export function Badge({ tone = 'neutral', icon: Icon, mono = false, className = '', children, ...rest }) {
  return (
    <span
      className={`badge badge--${tone} ${mono ? 'badge--mono' : ''} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={11} strokeWidth={2.2} aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Coloured status dot, used where a full badge would be too heavy. */
export function StatusDot({ tone = 'neutral', pulse = false }) {
  const colors = {
    neutral: 'var(--text-disabled)',
    green: 'var(--green-500)',
    amber: 'var(--amber-500)',
    red: 'var(--red-500)',
    accent: 'var(--accent)',
  };
  return (
    <span
      className={`dot ${pulse ? 'dot--live' : ''}`}
      style={{ color: colors[tone] ?? colors.neutral }}
      aria-hidden="true"
    />
  );
}
