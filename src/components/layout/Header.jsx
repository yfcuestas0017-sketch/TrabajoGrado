import { useEffect, useRef, useState } from 'react';
import { Bell, Menu, Palette, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import ThemePanel from '../ui/ThemePanel';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../lib/supabase/client';
import { hasSupabaseConfig } from '../../lib/supabase/config';

export default function Header({ title, subtitle }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [assignedProjects, setAssignedProjects] = useState([]);
  const notifRef = useRef(null);
  const { toggleMobileSidebar } = useTheme();

  useEffect(() => {
    let mounted = true;

    const loadNotifications = async () => {
      if (!hasSupabaseConfig || !user?.id) {
        if (mounted) setAssignedProjects([]);
        return;
      }

      setNotifLoading(true);
      setNotifError('');

      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('user_projects')
          .select('project_role, projects(project_id, title, code, created_at)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false, foreignTable: 'projects' });

        if (error) {
          throw new Error(error.message);
        }

        const mapped = (data || [])
          .filter(row => row.projects)
          .map(row => ({
            projectId: row.projects.project_id,
            title: row.projects.title,
            code: row.projects.code,
            createdAt: row.projects.created_at,
            role: row.project_role || 'asignado',
          }));

        if (mounted) setAssignedProjects(mapped);
      } catch (err) {
        if (mounted) setNotifError('No se pudieron cargar las notificaciones.');
      } finally {
        if (mounted) setNotifLoading(false);
      }
    };

    loadNotifications();
    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  return (
    <>
      <header className="header">
        <div className="header-top">
          <div className="header-title-block">
            <h1 className="header-title">{title}</h1>
            {subtitle && <p className="header-subtitle">{subtitle}</p>}
          </div>

          <button
            type="button"
            className="header-btn header-btn--menu"
            onClick={toggleMobileSidebar}
            aria-label="Abrir menu"
            title="Abrir navegacion"
          >
            <Menu size={18} />
          </button>
        </div>

        <div className="header-actions">
          <div className="header-search">
            <Search size={15} className="header-search-icon" />
            <input
              type="text"
              placeholder="Buscar proyectos..."
              className="header-search-input"
            />
          </div>

          <div className="header-notif" ref={notifRef}>
            <button
              type="button"
              className="header-btn"
              aria-label="Notificaciones"
              onClick={() => setNotifOpen((prev) => !prev)}
            >
              <Bell size={18} />
              {assignedProjects.length > 0 && (
                <span className="notif-badge">{assignedProjects.length}</span>
              )}
            </button>

            {notifOpen && (
              <div className="notif-panel">
                <div className="notif-header">
                  <span>Proyectos asignados</span>
                  <span className="notif-count">{assignedProjects.length}</span>
                </div>

                {notifLoading ? (
                  <div className="notif-empty">Cargando...</div>
                ) : notifError ? (
                  <div className="notif-empty notif-empty--error">{notifError}</div>
                ) : assignedProjects.length === 0 ? (
                  <div className="notif-empty">No tienes proyectos asignados.</div>
                ) : (
                  <div className="notif-list">
                    {assignedProjects.map((item) => (
                      <button
                        key={`${item.projectId}-${item.role}`}
                        type="button"
                        className="notif-item"
                        onClick={() => {
                          setAssignedProjects((prev) =>
                            prev.filter((p) => !(p.projectId === item.projectId && p.role === item.role))
                          );
                          setNotifOpen(false);
                          navigate('/proyectos', { state: { projectId: item.projectId } });
                        }}
                      >
                        <div className="notif-title">{item.title}</div>
                        <div className="notif-meta">
                          <span className="notif-role">{item.role}</span>
                          {item.code && <span className="notif-code">{item.code}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="header-btn header-btn--accent"
            onClick={() => setThemePanelOpen(true)}
            aria-label="Personalizar tema"
            title="Personalizar apariencia"
          >
            <Palette size={18} />
          </button>
        </div>
      </header>

      <ThemePanel isOpen={themePanelOpen} onClose={() => setThemePanelOpen(false)} />

      <style>{`
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 32px;
          background: var(--bg-header);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 30;
        }

        .header-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          min-width: 0;
        }

        .header-title-block {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .header-title {
          font-family: var(--font-display);
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .header-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 1px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-search {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
        }

        .header-search-icon {
          position: absolute;
          left: 12px;
          color: var(--text-muted);
          pointer-events: none;
        }

        .header-search-input {
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          border-radius: var(--border-radius-md);
          padding: 8px 14px 8px 36px;
          font-size: 0.85rem;
          font-family: var(--font-body);
          color: var(--text-primary);
          width: 220px;
          transition: all var(--transition-fast);
          outline: none;
        }

        .header-search-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent);
          width: 260px;
        }

        .header-search-input::placeholder {
          color: var(--text-muted);
        }

        .header-btn {
          width: 38px;
          height: 38px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          border-radius: var(--border-radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }

        .header-btn:hover {
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }

        .header-notif {
          position: relative;
        }

        .notif-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: var(--accent-primary);
          color: #000;
          font-size: 0.65rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-sm);
        }

        .notif-panel {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          width: 320px;
          max-height: 360px;
          overflow: hidden;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: 40;
          display: flex;
          flex-direction: column;
          animation: fadeIn 0.2s ease;
        }

        .notif-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border-color);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .notif-count {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .notif-list {
          overflow-y: auto;
        }

        .notif-item {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border-color);
          background: transparent;
          border-left: none;
          border-right: none;
          border-top: none;
          width: 100%;
          text-align: left;
          cursor: pointer;
        }

        .notif-item:last-child {
          border-bottom: none;
        }

        .notif-item:hover {
          background: var(--bg-secondary);
        }

        .notif-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .notif-meta {
          display: flex;
          gap: 8px;
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .notif-role {
          text-transform: capitalize;
        }

        .notif-code {
          font-weight: 600;
          color: var(--accent-primary);
        }

        .notif-empty {
          padding: 16px;
          text-align: center;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .notif-empty--error {
          color: var(--accent-danger);
        }

        .header-btn--menu {
          display: none;
        }

        .header-btn--accent {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: #000;
        }

        .header-btn--accent:hover {
          background: var(--accent-primary-hover);
          border-color: var(--accent-primary-hover);
          color: #000;
        }

        @media (max-width: 1024px) {
          .header { padding: 18px 24px; gap: 14px; }
        }

        @media (max-width: 768px) {
          .header { flex-direction: row; align-items: center; justify-content: space-between; padding: 16px 20px; gap: 12px; }
          .header-top { flex: 1; min-width: 0; }
          .header-actions { gap: 8px; flex-direction: row-reverse; }
          .header-btn--menu { display: flex; }
          .header-search { max-width: 280px; }
          .header-title { font-size: 1.2rem; }
          .header-subtitle { font-size: 0.75rem; }
        }

        @media (max-width: 640px) {
          .header { padding: 14px 16px; }
          .header-search { max-width: 200px; }
          .header-search-input, .header-search-input:focus { width: 200px; font-size: 0.8rem; padding: 6px 10px 6px 32px; }
          .header-search-icon { left: 10px; }
          .header-btn { width: 36px; height: 36px; }
          .notif-panel { width: 280px; }
          .header-title { font-size: 1.1rem; }
        }

        @media (max-width: 480px) {
          .header { padding: 12px 12px; gap: 8px; }
          .header-search { display: none; }
          .header-actions { gap: 6px; }
          .header-btn { width: 34px; height: 34px; border-radius: 6px; }
          .notif-panel { width: 240px; right: -20px; }
          .header-title { font-size: 1rem; }
          .header-subtitle { font-size: 0.7rem; }
        }

        @media (max-width: 380px) {
          .header { padding: 10px 8px; }
          .header-title { font-size: 0.95rem; }
          .header-btn { width: 32px; height: 32px; }
        }
      `}</style>
    </>
  );
}
