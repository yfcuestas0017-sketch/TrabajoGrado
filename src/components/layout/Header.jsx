import { useEffect, useRef, useState } from 'react';
import { Bell, Menu, Palette, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import ThemePanel from '../ui/ThemePanel';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
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
      if (!user?.id) {
        if (mounted) setAssignedProjects([]);
        return;
      }

      setNotifLoading(true);
      setNotifError('');

      try {
        const allProjects = await api.getProjects();
        // Filter projects where current user is participant
        const userProjects = (allProjects || []).filter(p =>
          (p.user_projects || []).some(up => String(up.user_id) === String(user.id))
        ).map(p => {
          const up = (p.user_projects || []).find(u => String(u.user_id) === String(user.id));
          return {
            projectId: p.id,
            title: p.title,
            code: p.code,
            createdAt: p.created_at,
            role: up?.project_role || 'asignado',
          };
        });

        if (mounted) setAssignedProjects(userProjects);
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
