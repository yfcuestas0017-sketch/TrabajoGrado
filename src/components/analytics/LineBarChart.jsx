import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const COLORS = [
  'var(--accent-primary)',
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export default function LineBarChart({ data, horizontal = false }) {
  const chartData = Object.entries(data || {})
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => {
      const shortName = name.length > 28 ? name.substring(0, 25) + '...' : name;
      return { name: shortName, fullName: name, value };
    });

  if (chartData.length === 0) {
    return <div className="ax-empty-chart">Sin datos disponibles</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 32 + 40)}>
      <BarChart
        data={chartData}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 5, right: 20, left: horizontal ? 10 : 0, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-color)"
          opacity={0.5}
        />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis
              dataKey="name"
              type="category"
              width={140}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          </>
        )}
        <Tooltip
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '0.82rem',
            boxShadow: 'var(--shadow-md)',
          }}
          formatter={(value, _, props) => [`${value} proyectos`, props.payload.fullName]}
        />
        <Bar
          dataKey="value"
          radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
          animationBegin={0}
          animationDuration={700}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={entry.fullName}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
