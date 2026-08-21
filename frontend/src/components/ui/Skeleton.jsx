/** Shape-matched placeholder. Prefer this over a spinner for known layouts. */
export function Skeleton({ width = '100%', height = 12, radius, className = '', style }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** A few staggered lines, so loading copy resembles the text it replaces. */
export function SkeletonText({ lines = 3, gap = 'var(--sp-2)' }) {
  const widths = ['100%', '92%', '76%', '84%', '64%'];
  return (
    <div className="stack" style={{ gap }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} height={10} />
      ))}
    </div>
  );
}
