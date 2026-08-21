import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Side panel for record detail.
 *
 * Chosen over a modal so the underlying list stays visible - reading one memory
 * in the context of the others is the point. Same a11y contract as Modal:
 * Escape closes, focus is trapped, focus returns to the opener.
 */
export function Drawer({ open, onClose, title, eyebrow, footer, children }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  const trapFocus = useCallback((event) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null
    );
    if (!nodes.length) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
      } else {
        trapFocus(event);
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector(FOCUSABLE);
      (target ?? panelRef.current)?.focus();
    });

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      cancelAnimationFrame(raf);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose, trapFocus]);

  if (!open) return null;

  return createPortal(
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <aside
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Detail'}
        tabIndex={-1}
      >
        <header className="drawer__header">
          <div className="grow" style={{ minWidth: 0 }}>
            {eyebrow && <p className="drawer__eyebrow">{eyebrow}</p>}
            {title && <h2 className="drawer__title">{title}</h2>}
          </div>
          <IconButton icon={X} label="Close panel" onClick={onClose} />
        </header>

        <div className="drawer__body">{children}</div>

        {footer && <footer className="drawer__footer">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}
