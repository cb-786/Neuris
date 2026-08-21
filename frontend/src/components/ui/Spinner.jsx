/** Indeterminate loader. Sized in px so it can sit inline with text or icons. */
export function Spinner({ size = 15, className = '', label }) {
  return (
    <span
      className={`spinner ${className}`}
      style={{ width: size, height: size, borderWidth: size > 20 ? 3 : 2 }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    />
  );
}
