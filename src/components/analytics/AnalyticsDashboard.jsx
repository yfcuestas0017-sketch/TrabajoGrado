import { useMemo, useState } from 'react';
import {
  BookOpen, CheckCircle, Clock, FolderOpen,
  GraduationCap, TrendingUp, Users, Award, Search, AlertCircle,
} from 'lucide-react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../ui/Card';
import { StatusPieChart, LineBarChart, SublineBarChart, TimelineChart } from '../analytics';

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase();
  const programScopedId = role === 'administrador' || role === 'estudiante' ? (user?.programId ?? null) : null;
  const analytics = useAnalytics(programScopedId);

  const [searchTitle, setSearchTitle] = useState('');

  const {
    totalProjects,
    numStudents,
    numLines,
    projectsByStatus,
    projectsByLine,
    topSublines,
    projectsByYearSemester,
    topLine,
    topProgram,
    topStatus,
    recentProjects,
  } = analytics;

  const approvedCount = Object.entries(projectsByStatus || {})
    .filter(([name]) => name?.toLowerCase().includes('aprobado') || name?.toLowerCase().includes('aprob'))
    .reduce((sum, [, v]) => sum + v, 0);

  const reviewCount = Object.entries(projectsByStatus || {})
    .filter(([name]) => name?.toLowerCase().includes('revisión') || name?.toLowerCase().includes('revision') || name?.toLowerCase().includes('pendiente') || name?.toLowerCase().includes('pend'))
    .reduce((sum, [, v]) => sum + v, 0);

  const finishedCount = Object.entries(projectsByStatus || {})
    .filter(([name]) => name?.toLowerCase().includes('finalizado') || name?.toLowerCase().includes('terminado') || name?.toLowerCase().includes('completado'))
    .reduce((sum, [, v]) => sum + v, 0);

  const filteredRecent = useMemo(() => {
    if (!searchTitle.trim()) return recentProjects || [];
    const q = searchTitle.toLowerCase().trim();
    return (recentProjects || []).filter(p => p.title?.toLowerCase().includes(q));
  }, [recentProjects, searchTitle]);

  if (analytics.loading) {
    return (
      <div className="ax-loading">
        <div className="ax-spinner" />
        <p>Cargando analítica académica...</p>
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
            Los datos analíticos aparecerán cuando se registren proyectos en el sistema.
          </p>
        </div>
      </div>
    );
  }

  const isDocente = role === 'docente';
  const isEstudiante = role === 'estudiante';

  const statCards = [
    { id: 'total', label: 'Total Proyectos', value: totalProjects, icon: FolderOpen },
    { id: 'approved', label: 'Aprobados', value: approvedCount, icon: CheckCircle, accent: 'var(--accent-success)' },
    { id: 'review', label: 'En Revisión', value: reviewCount, icon: Clock, accent: '#f59e0b' },
    { id: 'finished', label: 'Finalizados', value: finishedCount, icon: TrendingUp, accent: '#3b82f6' },
    { id: 'students', label: 'Estudiantes', value: numStudents, icon: GraduationCap },
    { id: 'lines', label: 'Líneas de Investigación', value: numLines, icon: BookOpen },
  ];

  const visibleCards = (isDocente || isEstudiante)
    ? statCards.filter((stat) => stat.id === 'total' || stat.id === 'lines')
    : statCards;

  return (
    <div className="ax-dashboard">
      <div className="ax-section-row">
        <h2 className="ax-section-title">Analítica Académica</h2>
      </div>

      <div className="ax-search-bar">
        <Search size={16} className="ax-search-icon" />
        <input
          className="ax-search-input"
          type="text"
          placeholder="Buscar proyecto por título..."
          value={searchTitle}
          onChange={e => setSearchTitle(e.target.value)}
        />
      </div>

      <div className="ax-stats-grid stagger-children">
        {visibleCards.map(stat => (
          <StatCard
            key={stat.id}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            accentColor={stat.accent}
          />
        ))}
      </div>

      <div className="ax-charts-row">
        <div className="ax-chart-card">
          <div className="ax-chart-header">
            <h3>Distribución por Estado</h3>
          </div>
          <StatusPieChart data={projectsByStatus} />
        </div>

        <div className="ax-chart-card">
          <div className="ax-chart-header">
            <h3>Proyectos por Línea de Investigación</h3>
          </div>
          <LineBarChart data={projectsByLine} />
        </div>
      </div>

      <div className="ax-charts-row">
        <div className="ax-chart-card">
          <div className="ax-chart-header">
            <h3>Sublíneas más Utilizadas</h3>
          </div>
          <SublineBarChart data={topSublines} />
        </div>

        <div className="ax-chart-card">
          <div className="ax-chart-header">
            <h3>Registro de Proyectos por Período</h3>
          </div>
          <TimelineChart data={projectsByYearSemester} />
        </div>
      </div>

      <div className="ax-indicators-row">
        <div className="ax-indicator-card">
          <div className="ax-indicator-icon" style={{ background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)', color: 'var(--accent-primary)' }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <span className="ax-indicator-label">Línea con más proyectos</span>
            <span className="ax-indicator-value">{topLine ? topLine[0] : '—'}</span>
            {topLine && <span className="ax-indicator-sub">{topLine[1]} proyectos</span>}
          </div>
        </div>

        <div className="ax-indicator-card">
          <div className="ax-indicator-icon" style={{ background: 'color-mix(in srgb, #3b82f6 14%, transparent)', color: '#3b82f6' }}>
            <Users size={18} />
          </div>
          <div>
            <span className="ax-indicator-label">Programa con más participación</span>
            <span className="ax-indicator-value">{topProgram ? topProgram[0] : '—'}</span>
            {topProgram && <span className="ax-indicator-sub">{topProgram[1]} proyectos</span>}
          </div>
        </div>

        <div className="ax-indicator-card">
          <div className="ax-indicator-icon" style={{ background: 'color-mix(in srgb, #f59e0b 14%, transparent)', color: '#f59e0b' }}>
            <Award size={18} />
          </div>
          <div>
            <span className="ax-indicator-label">Estado predominante</span>
            <span className="ax-indicator-value">{topStatus ? topStatus[0] : '—'}</span>
            {topStatus && <span className="ax-indicator-sub">{topStatus[1]} proyectos</span>}
          </div>
        </div>
      </div>

      {!isDocente && !isEstudiante && (
        <>
          <div className="ax-section-row" style={{ marginTop: 28 }}>
            <h2 className="ax-section-title">Últimos Proyectos Registrados</h2>
          </div>

          <div className="ax-table-wrap">
            <table className="ax-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Línea</th>
                  <th>Estado</th>
                  <th>Programa</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecent.length > 0 ? (
                  filteredRecent.map(p => (
                    <tr key={p.id}>
                      <td className="ax-table-title">{p.title}</td>
                      <td>{p.lineName}</td>
                      <td><span className="ax-badge">{p.statusName}</span></td>
                      <td>{p.programName || '—'}</td>
                      <td>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-CO') : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="ax-table-empty">Sin resultados para la búsqueda</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
