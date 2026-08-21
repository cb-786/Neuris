import { forwardRef } from 'react';
import { Spinner } from './Spinner';

/**
 * The single button in the system. Variant + size are the only knobs, which
 * keeps every action in the app on the same height and radius scale.
 */
export const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    block = false,
    iconOnly = false,
    className = '',
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  const iconSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 15;

  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    iconOnly && 'btn--icon',
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Spinner size={iconSize} />
      ) : (
        Icon && <Icon size={iconSize} strokeWidth={2} aria-hidden="true" />
      )}
      {!iconOnly && children}
      {!loading && IconRight && <IconRight size={iconSize} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
});

/** Bare icon button for dense toolbars, where a bordered button would be noisy. */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, size = 'md', label, className = '', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`icon-btn ${size === 'sm' ? 'icon-btn--sm' : ''} ${className}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon size={size === 'sm' ? 13 : 16} strokeWidth={2} aria-hidden="true" />
    </button>
  );
});
