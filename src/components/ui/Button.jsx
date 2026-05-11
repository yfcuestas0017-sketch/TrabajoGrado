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

      <style>{`
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-family: var(--font-body);
          font-weight: 600;
          border: none;
          border-radius: var(--border-radius-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
          letter-spacing: -0.01em;
          position: relative;
          overflow: hidden;
          text-decoration: none;
        }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }

        /* Sizes */
        .btn--sm { padding: 6px 12px; font-size: 0.8rem; }
        .btn--md { padding: 9px 18px; font-size: 0.875rem; }
        .btn--lg { padding: 12px 24px; font-size: 1rem; }
        .btn--full { width: 100%; }

        /* Variants */
        .btn--primary {
          background: var(--accent-primary);
          color: #000;
        }
        .btn--primary:hover:not(:disabled) {
          background: var(--accent-primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px color-mix(in srgb, var(--accent-primary) 35%, transparent);
        }

        .btn--secondary {
          background: var(--accent-secondary);
          color: var(--text-inverse);
        }
        .btn--secondary:hover:not(:disabled) {
          background: var(--accent-secondary-hover);
          transform: translateY(-1px);
        }

        .btn--outline {
          background: transparent;
          border: 1.5px solid var(--accent-primary);
          color: var(--accent-primary);
        }
        .btn--outline:hover:not(:disabled) {
          background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
        }

        .btn--ghost {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }
        .btn--ghost:hover:not(:disabled) {
          background: var(--bg-primary);
          color: var(--text-primary);
          border-color: var(--text-muted);
        }

        .btn--danger {
          background: var(--accent-danger);
          color: white;
        }
        .btn--danger:hover:not(:disabled) {
          background: #dc2626;
          transform: translateY(-1px);
        }

        /* Spinner */
        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .btn--sm { padding: 6px 10px; font-size: 0.75rem; }
          .btn--md { padding: 8px 14px; font-size: 0.82rem; }
          .btn--lg { padding: 10px 18px; font-size: 0.92rem; }
        }

        @media (hover: none) and (pointer: coarse) {
          .btn {
            min-height: 44px;
          }
        }
      `}</style>
    </>
  );
}
