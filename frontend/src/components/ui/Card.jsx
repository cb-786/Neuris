/**
 * Surface container. Header/body/footer are separate exports so a card can be
 * composed without forcing padding on content that supplies its own (tables).
 */
export function Card({ interactive = false, flush = false, className = '', as: Tag = 'div', ...rest }) {
  const classes = [
    'card',
    interactive && 'card--interactive',
    flush && 'card--flush',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <Tag className={classes} {...rest} />;
}

export function CardHeader({ title, description, actions, className = '', children }) {
  return (
    <div className={`card__header ${className}`}>
      {children ?? (
        <div className="grow">
          <div className="card__title">{title}</div>
          {description && (
            <div style={{ marginTop: 2, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
              {description}
            </div>
          )}
        </div>
      )}
      {actions && <div className="row gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ tight = false, className = '', ...rest }) {
  return <div className={`card__body ${tight ? 'card__body--tight' : ''} ${className}`} {...rest} />;
}

export function CardFooter({ className = '', ...rest }) {
  return <div className={`card__footer ${className}`} {...rest} />;
}
