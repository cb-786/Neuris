/** Shown whenever a collection is legitimately empty (not loading, not failed). */
export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`empty ${className}`}>
      {Icon && (
        <div className="empty__icon">
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        </div>
      )}
      <div className="empty__title">{title}</div>
      {description && <p className="empty__text">{description}</p>}
      {action && <div style={{ marginTop: 'var(--sp-1)' }}>{action}</div>}
    </div>
  );
}
