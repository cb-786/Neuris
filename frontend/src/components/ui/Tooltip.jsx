import { useId, useState } from 'react';

/**
 * Lightweight hover/focus tooltip. Focus-triggered as well as hover, so
 * keyboard users get the same affordance.
 */
export function Tooltip({ label, placement = 'top', children }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="tooltip-host"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`tooltip ${placement === 'bottom' ? 'tooltip--below' : ''}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
