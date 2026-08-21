import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * Small anchored panel used for the system-status detail and menus.
 *
 * Closes on Escape, on outside pointerdown, and on route-level unmount; focus
 * returns to the trigger so keyboard users are never stranded.
 */
export function Popover({ trigger, children, placement = 'top', align = 'start', label }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const id = useId();

  const close = useCallback(
    ({ restoreFocus = true } = {}) => {
      setOpen(false);
      if (restoreFocus) triggerRef.current?.focus?.();
    },
    []
  );

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);

    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (first ?? panelRef.current)?.focus?.();
    });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      cancelAnimationFrame(raf);
    };
  }, [open, close]);

  return (
    <div className="popover-host" ref={wrapRef}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((v) => !v),
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
        'aria-controls': open ? id : undefined,
      })}

      {open && (
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className={`popover popover--${placement} popover--${align}`}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}
