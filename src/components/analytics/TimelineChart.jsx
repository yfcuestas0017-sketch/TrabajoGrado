import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function TimelineChart({ data }) {
  const chartData = (data || []).map(([period, count]) => ({
    period,
    proyectos: count,
  }));

  if (chartData.length === 0) {
    return <div className="ax-empty-chart">Sin datos disponibles</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-color)"
          opacity={0.5}
        />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
        />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '0.82rem',
            boxShadow: 'var(--shadow-md)',
          }}
          formatter={(value) => [`${value} proyectos`, 'Registrados']}
          labelFormatter={(label) => `Período: ${label}`}
        />
        <Line
          type="monotone"
          dataKey="proyectos"
          stroke="var(--accent-primary)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: 'var(--accent-primary)', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: 'var(--accent-primary)' }}
          animationBegin={0}
          animationDuration={800}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
