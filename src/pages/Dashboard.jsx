import { BookOpen, Clock, FolderOpen, TrendingUp, Upload, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import { StatCard } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';

const DASHBOARD_STATS = [
  { id: 'projects', label: 'Total Proyectos', value: '--', icon: FolderOpen },
  { id: 'faculties', label: 'Facultades', value: '--', icon: BookOpen },
  { id: 'pending', label: 'Pendientes', value: '--', icon: Clock },
  { id: 'users', label: 'Usuarios', value: '--', icon: Users },
];

const RECENT_PROJECTS = [];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const greeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) return 'Buenos dias';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const firstName = user?.name?.split(' ')[0] || 'Usuario';

  return (
    <DashboardLayout title="Dashboard" subtitle={`${greeting()}, ${firstName}`}>
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-eyebrow">Panel académico</span>
          <h2 className="dashboard-hero-title">Consulta el estado de los proyectos y accede a las funciones institucionales desde una vista centralizada.</h2>
          <p className="dashboard-hero-text">
            Esta pantalla prioriza información clara, navegación directa y una presentación sobria acorde con una plataforma universitaria.
          </p>
        </div>
      </div>

      <div className="stats-grid stagger-children">
        {DASHBOARD_STATS.map((stat) => (
          <StatCard
            key={stat.id}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="section-row">
        <h2 className="section-title">Acciones rapidas</h2>
      </div>

      <div className="quick-actions stagger-children">
        <div className="quick-card quick-card--primary" onClick={() => navigate('/subir')}>
          <div className="quick-card-icon">
            <Upload size={24} />
          </div>
          <div>
            <div className="quick-card-title">Gestión Docente</div>
            <div className="quick-card-desc">Prepara el flujo para registrar informacion real.</div>
          </div>
        </div>

        <div className="quick-card" onClick={() => navigate('/proyectos')}>
          <div className="quick-card-icon quick-card-icon--muted">
            <FolderOpen size={24} />
          </div>
          <div>
            <div className="quick-card-title">Ver Proyectos</div>
            <div className="quick-card-desc">Consulta la vista lista para datos de base de datos.</div>
          </div>
        </div>

        <div className="quick-card" onClick={() => navigate('/estadisticas')}>
          <div className="quick-card-icon quick-card-icon--muted">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="quick-card-title">Estadisticas</div>
            <div className="quick-card-desc">Reserva el espacio para reportes alimentados por backend.</div>
          </div>
        </div>
      </div>

      <div className="section-row" style={{ marginTop: 32 }}>
        <h2 className="section-title">Proyectos recientes</h2>
        <Button variant="ghost" size="sm" onClick={() => navigate('/proyectos')}>
          Ver todos
        </Button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Titulo</th>
              <th>Facultad</th>
              <th>Autor</th>
              <th>Anio</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_PROJECTS.length > 0 ? (
              RECENT_PROJECTS.map((project) => (
                <tr key={project.id} className="table-row">
                  <td className="table-title">{project.title}</td>
                  <td>
                    <span className="table-faculty">{project.faculty}</span>
                  </td>
                  <td className="table-author">{project.author}</td>
                  <td>{project.year}</td>
                  <td>{project.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="table-empty">
                  No hay proyectos cargados todavia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .dashboard-hero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
          padding: 24px 26px;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-xl);
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), transparent 58%),
            var(--bg-card);
          box-shadow: var(--shadow-sm);
        }

        .dashboard-hero-copy {
          max-width: 720px;
          min-width: 0;
        }

        .dashboard-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--accent-primary);
          margin-bottom: 8px;
        }

        .dashboard-hero-title {
          font-family: var(--font-display);
          font-size: 1.55rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
          line-height: 1.12;
          margin-bottom: 10px;
        }

        .dashboard-hero-text {
          color: var(--text-secondary);
          font-size: 0.92rem;
          line-height: 1.6;
          max-width: 58ch;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .section-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .quick-actions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .quick-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          cursor: pointer;
          transition: all var(--transition-base);
          box-shadow: var(--shadow-sm);
        }

        .quick-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: color-mix(in srgb, var(--accent-primary) 30%, var(--border-color));
        }

        .quick-card--primary {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
        }

        .quick-card--primary .quick-card-title,
        .quick-card--primary .quick-card-desc {
          color: #000 !important;
        }

        .quick-card--primary .quick-card-icon {
          background: rgba(0, 0, 0, 0.12) !important;
          color: #000;
        }

        .quick-card-icon {
          width: 48px;
          height: 48px;
          background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
          color: var(--accent-primary);
          border-radius: var(--border-radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .quick-card-icon--muted {
          background: var(--bg-primary);
          color: var(--text-secondary);
        }

        .quick-card-title {
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .quick-card-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-top: 2px;
          line-height: 1.5;
        }

        .table-wrap {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          box-shadow: var(--shadow-sm);
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
        }

        .table {
          width: 100%;
          min-width: 640px;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .table th {
          padding: 12px 20px;
          text-align: left;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
        }

        .table-row {
          border-bottom: 1px solid var(--border-color);
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table td {
          padding: 14px 20px;
        }

        .table-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .table-faculty,
        .table-author {
          color: var(--text-secondary);
        }

        .table-empty {
          padding: 36px 20px !important;
          text-align: center;
          color: var(--text-muted);
        }

        @media (max-width: 1100px) {
          .dashboard-hero {
            align-items: flex-start;
          }
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .quick-actions {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 700px) {
          .dashboard-hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 20px;
            margin-bottom: 20px;
          }

          .dashboard-hero-title {
            font-size: 1.35rem;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .quick-actions {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .dashboard-hero {
            padding: 18px 16px;
            border-radius: var(--border-radius-lg);
          }

          .dashboard-hero-title {
            font-size: 1.18rem;
          }

          .dashboard-hero-text {
            font-size: 0.85rem;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .section-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .table-wrap {
            border-radius: var(--border-radius-md);
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
