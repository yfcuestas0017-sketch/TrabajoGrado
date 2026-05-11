export default function Card({ children, className = '', padding = 'md', hover = false, onClick }) {
  const paddings = { sm: '16px', md: '24px', lg: '32px' };
  return (
    <>
      <div
        className={`card${hover ? ' card--hover' : ''}${onClick ? ' card--clickable' : ''} ${className}`}
        style={{ padding: paddings[padding] }}
        onClick={onClick}
      >
        {children}
      </div>
      <style>{`
        .card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-base);
        }
        .card--hover:hover {
          box-shadow: var(--shadow-md);
          border-color: color-mix(in srgb, var(--accent-primary) 30%, var(--border-color));
          transform: translateY(-2px);
        }
        .card--clickable { cursor: pointer; }

        @media (max-width: 640px) {
          .card {
            border-radius: var(--border-radius-md);
          }
        }
      `}</style>
    </>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, trend, trendLabel, accentColor }) {
  const isPositive = trend > 0;
  return (
    <>
      <div className="stat-card">
        <div className="stat-card-header">
          <span className="stat-card-label">{label}</span>
          {Icon && (
            <div className="stat-card-icon" style={{ background: `color-mix(in srgb, var(--accent-primary) 12%, transparent)` }}>
              <Icon size={16} style={{ color: 'var(--accent-primary)' }} />
            </div>
          )}
        </div>
        <div className="stat-card-value">{value}</div>
        {trend !== undefined && (
          <div className={`stat-card-trend${isPositive ? ' stat-card-trend--up' : ' stat-card-trend--down'}`}>
            <span>{isPositive ? '↑' : '↓'} {Math.abs(trend)}%</span>
            {trendLabel && <span className="stat-card-trend-label">{trendLabel}</span>}
          </div>
        )}
      </div>
      <style>{`
        .stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          padding: 24px;
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-base);
        }
        .stat-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }
        .stat-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .stat-card-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .stat-card-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-card-value {
          font-family: var(--font-display);
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
          line-height: 1;
          margin-bottom: 8px;
        }
        .stat-card-trend {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 600;
        }
        .stat-card-trend--up { color: var(--accent-success); }
        .stat-card-trend--down { color: var(--accent-danger); }
        .stat-card-trend-label { color: var(--text-muted); font-weight: 400; }

        @media (max-width: 640px) {
          .stat-card {
            padding: 18px;
          }

          .stat-card-value {
            font-size: 1.6rem;
          }

          .stat-card-label {
            font-size: 0.72rem;
          }
        }

        @media (max-width: 480px) {
          .stat-card {
            padding: 16px;
          }

          .stat-card-header {
            align-items: flex-start;
          }

          .stat-card-icon {
            width: 30px;
            height: 30px;
          }
        }
      `}</style>
    </>
  );
}
