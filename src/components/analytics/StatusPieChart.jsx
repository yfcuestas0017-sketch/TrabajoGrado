import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = [
  '#1F5BA3',
  '#BA1828',
  '#2C3967',
  '#E00F38',
  '#2563eb',
  '#dc2626',
  '#1d4ed8',
  '#9f1239',
];

export default function StatusPieChart({ data }) {
  const chartData = Object.entries(data || {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) {
    return <div className="ax-empty-chart">Sin datos disponibles</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
          animationBegin={0}
          animationDuration={800}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={COLORS[index % COLORS.length]}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '0.82rem',
            boxShadow: 'var(--shadow-md)',
          }}
          formatter={(value, name) => [`${value} proyectos`, name]}
        />
        <Legend
          wrapperStyle={{ fontSize: '0.78rem' }}
          formatter={(value) => (
            <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
