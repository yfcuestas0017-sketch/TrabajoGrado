import './Button.css';
export default function Button({
  children,
  variant = 'primary',   // primary | secondary | ghost | danger | outline
  size = 'md',           // sm | md | lg
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <>
      <button
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        className={`btn btn--${variant} btn--${size}${fullWidth ? ' btn--full' : ''} ${className}`}
        {...props}
      >
        {loading ? (
          <span className="btn-spinner" />
        ) : (
          <>
            {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
            {children && <span>{children}</span>}
            {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
          </>
        )}
      </button>

    </>
  );
}
