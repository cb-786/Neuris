import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { IconButton } from './Button';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
};

/** Inline, non-blocking message. Errors use role=alert so SRs announce them. */
export function Alert({ tone = 'info', title, children, onDismiss, className = '' }) {
  const Icon = ICONS[tone] ?? Info;
  return (
    <div
      className={`alert alert--${tone} ${className}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      <div className="alert__body grow">
        {title && <div className="alert__title">{title}</div>}
        {children && <div className="alert__text">{children}</div>}
      </div>
      {onDismiss && <IconButton icon={X} size="sm" label="Dismiss" onClick={onDismiss} />}
    </div>
  );
}
