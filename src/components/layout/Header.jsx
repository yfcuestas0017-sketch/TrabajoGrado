import { useEffect, useRef, useState } from 'react';
import { Bell, Menu, Palette, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import ThemePanel from '../ui/ThemePanel';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../lib/supabase/client';
import { hasSupabaseConfig } from '../../lib/supabase/config';
import './Header.css';

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

    </>
  );
}
