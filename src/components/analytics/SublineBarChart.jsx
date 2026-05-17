import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const COLORS = [
  '#3b82f6',
  'var(--accent-primary)',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export default function SublineBarChart({ data }) {
  const chartData = (data || [])
    .map(([name, value]) => {
      const shortName = name.length > 30 ? name.substring(0, 27) + '...' : name;
      return { name: shortName, fullName: name, value };
    });

  if (chartData.length === 0) {
    return <div className="ax-empty-chart">Sin datos disponibles</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 34 + 40)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-color)"
          opacity={0.5}
        />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <YAxis
          dataKey="name"
          type="category"
          width={150}
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
        />
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
          radius={[0, 6, 6, 0]}
          animationBegin={0}
          animationDuration={700}
        >
          {chartData.map((entry, index) => (
            <Cell key={entry.fullName} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
