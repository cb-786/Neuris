/**
 * NEURIS identity mark.
 *
 * Three memories converging on a single recall node - the product's whole
 * premise in one glyph. Drawn inline so it inherits currentColor and stays
 * crisp at 16px, rather than borrowing a generic icon from the icon set.
 */
export function NeurisMark({ size = 20, className = '', title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      {/* connective paths */}
      <path
        d="M6 5.5 L15.5 12 M6 18.5 L15.5 12 M4.5 12 L15.5 12"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* source memories */}
      <circle cx="5.6" cy="5.4" r="1.75" fill="currentColor" opacity="0.7" />
      <circle cx="4.4" cy="12" r="1.5" fill="currentColor" opacity="0.55" />
      <circle cx="5.6" cy="18.6" r="1.75" fill="currentColor" opacity="0.7" />
      {/* recall node */}
      <circle cx="16.6" cy="12" r="3.4" fill="currentColor" />
    </svg>
  );
}

/**
 * Ambient graph motif for large empty areas. Purely decorative and very low
 * contrast - it should read as texture, never as content.
 */
export function MemoryMotif({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 120"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <g stroke="var(--motif-line)" strokeWidth="1">
        <path d="M30 84 L96 44 L168 70 L238 32 L296 60" />
        <path d="M96 44 L120 96 L168 70" />
        <path d="M168 70 L206 104" />
        <path d="M238 32 L296 60 L268 100" />
      </g>
      <g fill="var(--motif-node)">
        <circle cx="30" cy="84" r="2.5" />
        <circle cx="96" cy="44" r="3.5" />
        <circle cx="120" cy="96" r="2.5" />
        <circle cx="168" cy="70" r="4" />
        <circle cx="206" cy="104" r="2.5" />
        <circle cx="238" cy="32" r="3.5" />
        <circle cx="268" cy="100" r="2.5" />
        <circle cx="296" cy="60" r="3" />
      </g>
    </svg>
  );
}
