import { Trophy } from 'lucide-react';

export default function RankingAdvisors({ data }) {
  if (!data || data.length === 0) {
    return <div className="ax-empty-chart">Sin datos disponibles</div>;
  }

  const maxVal = Math.max(1, data[0]?.[1] || 1);

  return (
    <div className="ax-ranking">
      {data.map(([name, count], index) => (
        <div key={name} className="ax-ranking-item">
          <div className="ax-ranking-pos">
            {index === 0 ? (
              <Trophy size={16} style={{ color: '#f59e0b' }} />
            ) : (
              <span className="ax-ranking-num">{index + 1}</span>
            )}
          </div>
          <div className="ax-ranking-body">
            <span className="ax-ranking-name">{name}</span>
            <div className="ax-ranking-bar-track">
              <div
                className="ax-ranking-bar-fill"
                style={{ width: `${(count / maxVal) * 100}%` }}
              />
            </div>
          </div>
          <span className="ax-ranking-count">{count}</span>
        </div>
      ))}
    </div>
  );
}
