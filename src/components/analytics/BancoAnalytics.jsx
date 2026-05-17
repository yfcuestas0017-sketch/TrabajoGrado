import { useMemo, useState } from 'react';
import { ChevronDown, Filter, TrendingUp, Search, AlertCircle, FolderOpen, X } from 'lucide-react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useAuth } from '../../context/AuthContext';
import { StatusPieChart, LineBarChart, SublineBarChart, TimelineChart, HeatmapChart, RankingAdvisors } from '../analytics';

export default function BancoAnalytics() {
  const { user } = useAuth();
  const adminProgramId = user?.role?.toLowerCase() === 'administrador' ? (user?.programId ?? null) : null;
  const analytics = useAnalytics(adminProgramId);

  const [filters, setFilters] = useState({
    status: '',
    line: '',
    subline: '',
    year: '',
  });
  const [searchTitle, setSearchTitle] = useState('');

  const filteredProjects = useMemo(() => {
    if (!analytics.projects) return [];
    return analytics.projects.filter(p => {
      const programName = (p.programName || '').toLowerCase();
      if (programName && !programName.includes('ingenier') && !programName.includes('sistemas')) return false;
      if (searchTitle.trim()) {
        const q = searchTitle.toLowerCase().trim();
        if (!p.title?.toLowerCase().includes(q)) return false;
      }
      if (filters.status && p.statusName !== filters.status) return false;
      if (filters.line && p.lineName !== filters.line) return false;
      if (filters.subline && p.sublineName !== filters.subline) return false;
      if (filters.year && String(p.year) !== filters.year) return false;
      return true;
    });
  }, [analytics.projects, filters, searchTitle]);

  const filteredStats = useMemo(() => {
    const byStatus = {};
    const byLine = {};
    const bySubline = {};
    const byProgram = {};
    const byPeriod = {};

    filteredProjects.forEach(p => {
      byStatus[p.statusName] = (byStatus[p.statusName] || 0) + 1;
      byLine[p.lineName] = (byLine[p.lineName] || 0) + 1;
      if (p.sublineName && p.sublineName !== 'Sin sublínea') {
        bySubline[p.sublineName] = (bySubline[p.sublineName] || 0) + 1;
      }
      const prog = p.programName || 'Sin programa';
      byProgram[prog] = (byProgram[prog] || 0) + 1;
      if (p.year && p.semester) {
        const key = `${p.year}-${p.semester}`;
        byPeriod[key] = (byPeriod[key] || 0) + 1;
      }
    });

    const topSublines = Object.entries(bySubline).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const sortedPeriods = Object.entries(byPeriod).sort((a, b) => a[0].localeCompare(b[0]));

    const filteredMatrix = {};
    analytics.lines?.forEach(l => { filteredMatrix[l.name] = {}; });
    filteredProjects.forEach(p => {
      if (p.lineName && p.sublineName && p.sublineName !== 'Sin sublínea') {
        if (!filteredMatrix[p.lineName]) filteredMatrix[p.lineName] = {};
        filteredMatrix[p.lineName][p.sublineName] = (filteredMatrix[p.lineName][p.sublineName] || 0) + 1;
      }
    });

    const areasRank = Object.entries(byLine).sort((a, b) => b[1] - a[1]);
    const currentYear = new Date().getFullYear();
    const currentSemester = new Date().getMonth() + 1 <= 6 ? 'S1' : 'S2';
    const currentPeriod = `${currentYear}-${currentSemester}`;
    const lastPeriodCount = byPeriod[currentPeriod] || 0;
    const prevPeriods = sortedPeriods.filter(([k]) => k !== currentPeriod);
    const prevCount = prevPeriods.length > 0 ? prevPeriods[prevPeriods.length - 1][1] : 0;
    const growthPercent = prevCount > 0 ? Math.round(((lastPeriodCount - prevCount) / prevCount) * 100) : 0;

    return {
      total: filteredProjects.length,
      byStatus,
      byLine,
      topSublines,
      byProgram,
      byPeriod: sortedPeriods,
      lineSublineMatrix: filteredMatrix,
      areasRank,
      growthPercent,
    };
  }, [filteredProjects, analytics.lines]);

  const uniqueYears = useMemo(() => {
    const years = new Set();
    (analytics.projects || []).forEach(p => { if (p.year) years.add(String(p.year)); });
    return [...years].sort();
  }, [analytics.projects]);

  const availableSublines = useMemo(() => {
    if (!filters.line) return analytics.sublines || [];
    return (analytics.sublines || []).filter(
      sl => String(sl.research_line_id) === String(
        analytics.lines?.find(l => l.name === filters.line)?.research_line_id
      )
    );
  }, [filters.line, analytics.sublines, analytics.lines]);

  if (analytics.loading) {
    return (
      <div className="ax-loading">
        <div className="ax-spinner" />
        <p>Cargando analítica...</p>
      </div>
    );
  }

  if (analytics.error) {
    return (
      <div className="ax-error-banner">
        <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        {analytics.error}
      </div>
    );
  }

  if (!analytics.projects || analytics.projects.length === 0) {
    return (
      <div className="ax-empty-chart" style={{ minHeight: 120 }}>
        <div style={{ textAlign: 'center' }}>
          <FolderOpen size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No hay proyectos registrados aún</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
            Los datos del banco de proyectos aparecerán cuando se registren proyectos.
          </p>
        </div>
      </div>
    );
  }

  const handleFilter = (key) => (e) => {
    const val = e.target.value;
    setFilters(prev => {
      const updated = { ...prev, [key]: val };
      if (key === 'line') {
        updated.subline = '';
      }
      return updated;
    });
  };

  const clearFilters = () => {
    setFilters({ status: '', line: '', subline: '', year: '' });
    setSearchTitle('');
  };

  const hasActiveFilters = Object.values(filters).some(v => v) || searchTitle.trim() !== '';

  return (
    <div className="banco-analytics">
      <div className="filters-card">
        <div className="filters-header">
          <div className="filters-title">
            <Filter size={16} />
            <span>Filtros de busqueda</span>
          </div>
          <div className="filters-meta">
            <span className="filters-count">{filteredStats.total} resultados</span>
            {hasActiveFilters && (
              <button className="filters-clear" onClick={clearFilters}>
                <X size={13} /> Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="filters-grid">
          <div className="field">
            <label className="field-label">Buscar</label>
            <div className="search-wrap">
              <Search size={14} className="search-icon" />
              <input
                className="field-input search-input"
                type="text"
                placeholder="Titulo del proyecto"
                value={searchTitle}
                onChange={e => setSearchTitle(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Estado</label>
            <div className="select-wrap">
              <select className="field-input field-select" value={filters.status} onChange={handleFilter('status')}>
                <option value="">Todos</option>
                {analytics.statuses?.map(s => <option key={s.status_id} value={s.name}>{s.name}</option>)}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Línea</label>
            <div className="select-wrap">
              <select className="field-input field-select" value={filters.line} onChange={handleFilter('line')}>
                <option value="">Todas</option>
                {analytics.lines?.map(l => <option key={l.research_line_id} value={l.name}>{l.name}</option>)}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Sublínea</label>
            <div className="select-wrap">
              <select className="field-input field-select" value={filters.subline} onChange={handleFilter('subline')}>
                <option value="">Todas</option>
                {availableSublines.map(sl => <option key={sl.research_subline_id} value={sl.name}>{sl.name}</option>)}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Año</label>
            <div className="select-wrap">
              <select className="field-input field-select" value={filters.year} onChange={handleFilter('year')}>
                <option value="">Todos</option>
                {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>
          </div>
        </div>
      </div>

      <div className="ba-summary-cards">
        <div className="ba-summary-card ba-summary-card--total">
          <span className="ba-summary-label">Proyectos encontrados</span>
          <span className="ba-summary-value">{filteredStats.total}</span>
        </div>
        <div className="ba-summary-card">
          <span className="ba-summary-label">Líneas activas</span>
          <span className="ba-summary-value">{Object.keys(filteredStats.byLine).length}</span>
        </div>
        <div className="ba-summary-card">
          <span className="ba-summary-label">Programas participantes</span>
          <span className="ba-summary-value">{Object.keys(filteredStats.byProgram).length}</span>
        </div>
      </div>

      <div className="ax-charts-row">
        <div className="ax-chart-card">
          <div className="ax-chart-header"><h3>Proyectos por Programa Académico</h3></div>
          <LineBarChart data={filteredStats.byProgram} />
        </div>

        <div className="ax-chart-card">
          <div className="ax-chart-header"><h3>Distribución por Estado</h3></div>
          <StatusPieChart data={filteredStats.byStatus} />
        </div>
      </div>

      <div className="ax-charts-row">
        <div className="ax-chart-card">
          <div className="ax-chart-header"><h3>Relación Líneas × Sublíneas</h3></div>
          <HeatmapChart matrix={filteredStats.lineSublineMatrix} />
        </div>

        <div className="ax-chart-card">
          <div className="ax-chart-header"><h3>Directores con más Proyectos</h3></div>
          <RankingAdvisors data={analytics.topAdvisor} />
        </div>
      </div>

      <div className="ax-charts-row">
        <div className="ax-chart-card" style={{ gridColumn: 'span 2' }}>
          <div className="ax-chart-header"><h3>Evolución de Proyectos Registrados</h3></div>
          <TimelineChart data={filteredStats.byPeriod} />
        </div>
      </div>

      <style>{`
        .filters-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          padding: 18px 20px;
          box-shadow: var(--shadow-sm);
        }

        .filters-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .filters-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .filters-meta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .filters-count {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .filters-clear {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-muted);
          font-size: 0.72rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .filters-clear:hover {
          color: var(--text-primary);
          border-color: color-mix(in srgb, var(--accent-primary) 30%, var(--border-color));
        }

        .filters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .field-input {
          width: 100%;
          padding: 10px 13px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          background: var(--bg-secondary);
          font-size: 0.88rem;
          font-family: var(--font-body);
          color: var(--text-primary);
          outline: none;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
          box-sizing: border-box;
        }

        .field-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 14%, transparent);
        }

        .select-wrap {
          position: relative;
        }

        .field-select {
          appearance: none;
          padding-right: 34px;
          cursor: pointer;
        }

        .select-chevron {
          position: absolute;
          right: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .search-wrap {
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .search-input {
          padding-left: 34px;
        }

        @media (max-width: 720px) {
          .filters-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
