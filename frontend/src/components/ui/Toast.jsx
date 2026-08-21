import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { info: Info, success: CheckCircle2, warn: AlertTriangle, error: XCircle };
const COLORS = {
  info: 'var(--blue-500)',
  success: 'var(--green-500)',
  warn: 'var(--amber-500)',
  error: 'var(--red-500)',
};

/** Transient confirmations. Errors that need a decision belong in an Alert. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, { tone = 'info', duration = 4000 } = {}) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((list) => [...list, { id, message, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          style={{
            position: 'fixed',
            top: 'calc(var(--topbar-h) + var(--sp-3))',
            right: 'var(--sp-4)',
            zIndex: 'var(--z-toast)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-2)',
            maxWidth: 'min(380px, calc(100vw - 2 * var(--sp-4)))',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => {
            const Icon = ICONS[t.tone] ?? Info;
            return (
              <div
                key={t.id}
                role={t.tone === 'error' ? 'alert' : 'status'}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--sp-2)',
                  padding: 'var(--sp-3) var(--sp-3)',
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--r-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  fontSize: 'var(--fs-md)',
                  color: 'var(--text-primary)',
                  pointerEvents: 'auto',
                  animation: 'neuris-pop var(--dur-mid) var(--ease-out)',
                }}
              >
                <Icon
                  size={15}
                  strokeWidth={2}
                  style={{ color: COLORS[t.tone], flex: 'none', marginTop: 2 }}
                  aria-hidden="true"
                />
                <span style={{ flex: 1, minWidth: 0, lineHeight: 'var(--lh-snug)' }}>{t.message}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(t.id)}
                >
                  <X size={13} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
