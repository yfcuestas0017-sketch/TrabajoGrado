import { useMemo } from 'react';

export default function HeatmapChart({ matrix }) {
  const { rows, cols, values, maxVal } = useMemo(() => {
    const lineNames = Object.keys(matrix || {});
    const sublineSet = new Set();
    lineNames.forEach(line => {
      Object.keys(matrix[line] || {}).forEach(sl => sublineSet.add(sl));
    });
    const sublineNames = [...sublineSet];

    const allValues = [];
    lineNames.forEach(line => {
      sublineNames.forEach(sl => {
        const v = matrix[line]?.[sl] || 0;
        allValues.push(v);
      });
    });
    const mx = Math.max(1, ...allValues);

    return { rows: lineNames, cols: sublineNames, values: allValues, maxVal: mx };
  }, [matrix]);

  if (rows.length === 0 || cols.length === 0) {
    return <div className="ax-empty-chart">Sin datos disponibles</div>;
  }

  const getOpacity = (val) => {
    if (val === 0) return 0.06;
    return 0.2 + (val / maxVal) * 0.8;
  };

  return (
    <div className="ax-heatmap-wrapper">
      <div className="ax-heatmap-scroll">
        <table className="ax-heatmap">
          <thead>
            <tr>
              <th className="ax-heatmap-corner"></th>
              {cols.map(col => (
                <th key={col} className="ax-heatmap-col">
                  <span title={col}>{col.length > 14 ? col.substring(0, 12) + '..' : col}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(line => (
              <tr key={line}>
                <td className="ax-heatmap-row-label" title={line}>
                  {line.length > 18 ? line.substring(0, 16) + '..' : line}
                </td>
                {cols.map(sl => {
                  const val = matrix[line]?.[sl] || 0;
                  return (
                    <td
                      key={sl}
                      className="ax-heatmap-cell"
                      style={{ background: `color-mix(in srgb, var(--accent-primary) ${getOpacity(val) * 100}%, transparent)` }}
                      title={`${line} × ${sl}: ${val} proyectos`}
                    >
                      {val > 0 ? val : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
      </table>
      </div>
    </div>
  );
}
