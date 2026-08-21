/**
 * Mutually exclusive choice between 2-4 options. Uses a tablist role so arrow
 * keys and screen readers behave as expected.
 */
export function Segmented({ value, onChange, options, label, size }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="segmented__item"
            title={opt.hint}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            style={opt.disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >
            {Icon && <Icon size={13} strokeWidth={2} aria-hidden="true" />}
            {opt.label && <span className={size === 'compact' ? 'hide-xs' : undefined}>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
