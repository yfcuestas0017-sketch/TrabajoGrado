import './StatCard.css';

export function StatCard({ label, value, icon: Icon, trend, trendLabel, accentColor }) {
  const isPositive = trend > 0;
  return (
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
  );
}

export default StatCard;
