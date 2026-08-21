import { Skeleton } from './Skeleton';

/**
 * KPI tile. Value is the loudest element; label and footnote stay quiet so a
 * row of these can be scanned in one pass.
 */
export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  footnote,
  tone,
  loading = false,
  children,
}) {
  return (
    <div className="stat">
      <div className="stat__top">
        {Icon && <Icon size={14} strokeWidth={2} className="stat__icon" aria-hidden="true" />}
        <span className="stat__label">{label}</span>
      </div>

      {loading ? (
        <Skeleton width="58%" height={30} radius="var(--r-sm)" />
      ) : (
        <div className="stat__value" style={tone ? { color: `var(--${tone}-500)` } : undefined}>
          {value}
          {unit && <span className="stat__unit">{unit}</span>}
        </div>
      )}

      {children}

      {footnote && !loading && <div className="stat__foot">{footnote}</div>}
    </div>
  );
}
