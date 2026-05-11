import { BookOpen } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function BancoProyectos() {
  const faculties = [];

  return (
    <DashboardLayout title="Banco de Proyectos" subtitle="">
      {faculties.length > 0 ? (
        <div className="faculties-grid">
          {faculties.map((faculty) => (
            <div key={faculty.id} className="faculty-card">
              <div className="faculty-dot" />
              <div className="faculty-info">
                <span className="faculty-name">{faculty.name}</span>
                <span className="faculty-count">{faculty.projectCount} proyectos</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="page-coming page-coming--compact">
          <div className="page-coming-icon">
            <BookOpen size={36} />
          </div>
          <h2>Sin proyectos registrados</h2>
          <p>Esta vista mostrará la información real cuando conectemos la base de datos.</p>
        </div>
      )}

      <style>{`
        .faculties-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 14px;
        }
        .faculty-card {
          background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--border-radius-lg);
          padding: 20px; display: flex; align-items: center; gap: 12px; box-shadow: var(--shadow-sm);
        }
        .faculty-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: var(--accent-primary); }
        .faculty-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .faculty-name { font-weight: 700; font-size: 0.9rem; color: var(--text-primary); }
        .faculty-count { font-size: 0.78rem; color: var(--text-muted); }

        .page-coming {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
          text-align: center; padding: 80px 40px; background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: var(--border-radius-xl); box-shadow: var(--shadow-sm);
        }
        .page-coming--compact { padding: 56px 32px; }
        .page-coming-icon {
          width: 72px; height: 72px; background: var(--bg-primary); border-radius: 20px;
          display: flex; align-items: center; justify-content: center; color: var(--text-primary);
        }
        .page-coming h2 { font-family: var(--font-display); font-size: 1.5rem; color: var(--text-primary); letter-spacing: -0.02em; }
        .page-coming p { max-width: 480px; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.7; }
      `}</style>
    </DashboardLayout>
  );
}
