import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/proyectos', label: 'Gestion de Proyectos', icon: FolderOpen },
  { to: '/subir', label: 'Gestion de Docente', icon: Upload },
  { to: '/facultades', label: 'Banco de Proyectos', icon: BookOpen },
];

const NAV_BOTTOM = [
  { to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const {
    sidebarCollapsed,
    toggleSidebar,
    mobileSidebarOpen,
    closeMobileSidebar,
  } = useTheme();
  const navigate = useNavigate();

  const canAccessAdmin = user?.role === 'admin' || user?.authMode === 'local';
  const isSidebarExpanded = mobileSidebarOpen || !sidebarCollapsed;

  const handleLogout = async () => {
    closeMobileSidebar();
    await logout();
    navigate('/login');
  };

  const handleNavigation = () => {
    if (mobileSidebarOpen) {
      closeMobileSidebar();
    }
  };

  const handleSidebarToggle = () => {
    if (mobileSidebarOpen) {
      closeMobileSidebar();
      return;
    }

    toggleSidebar();
  };

  return (
    <>
      {mobileSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menu"
          onClick={closeMobileSidebar}
        />
      )}

      <aside
        className={`sidebar${mobileSidebarOpen ? ' sidebar--mobile-open' : ''}`}
        style={{
          '--sidebar-current-width': sidebarCollapsed ? '68px' : 'var(--sidebar-width)',
        }}
      >
        <div className="sidebar-logo">
          <img src="/Escudos.png" alt="Logo UCESMAG" className="sidebar-logo-img" />

          {isSidebarExpanded && (
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-name">Gestión de Proyectos</span>
              <span className="sidebar-logo-sub">Universidad CESMAG</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={handleSidebarToggle}
          aria-label="Alternar menu"
        >
          {mobileSidebarOpen ? (
            <X size={16} />
          ) : sidebarCollapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronLeft size={16} />
          )}
        </button>

        <nav className="sidebar-nav">
          {isSidebarExpanded && <span className="sidebar-section-label">Navegacion</span>}

          {NAV_ITEMS.filter(item => {
            if (item.to === '/subir' && ['estudiante', 'docente'].includes(user?.role)) return false;
            return true;
          }).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={isSidebarExpanded ? undefined : label}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
              }
              onClick={handleNavigation}
            >
              <Icon size={18} />
              {isSidebarExpanded && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {isSidebarExpanded && <span className="sidebar-section-label">Sistema</span>}

          {NAV_BOTTOM.filter((item) => !item.adminOnly || canAccessAdmin).map(
            ({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={isSidebarExpanded ? undefined : label}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
                }
                onClick={handleNavigation}
              >
                <Icon size={18} />
                {isSidebarExpanded && <span>{label}</span>}
              </NavLink>
            ),
          )}

          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>

            {isSidebarExpanded && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.name}</span>
                <span className="sidebar-user-role">
                  {user?.authMode === 'local' ? 'sesion local' : user?.role}
                </span>
              </div>
            )}

            {isSidebarExpanded && (
              <button
                type="button"
                className="sidebar-logout"
                onClick={handleLogout}
                title="Cerrar sesion"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>

        <style>{`
          .sidebar-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.44);
            border: none;
            padding: 0;
            z-index: 39;
          }

          .sidebar {
            display: flex;
            flex-direction: column;
            background: var(--sidebar-bg);
            width: var(--sidebar-current-width);
            min-width: var(--sidebar-current-width);
            height: 100dvh;
            position: sticky;
            top: 0;
            transition: width var(--transition-base), min-width var(--transition-base), transform var(--transition-base);
            flex-shrink: 0;
            overflow: hidden;
            z-index: 40;
            border-right: 1px solid var(--sidebar-border);
          }

          .sidebar-logo {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            gap: 12px;
            padding: 32px 8px 24px;
            border-bottom: 1px solid var(--sidebar-border);
            overflow: hidden;
          }

          .sidebar-logo-img {
            width: 60px;
            height: auto;
            object-fit: contain;
            flex-shrink: 0;
            filter: drop-shadow(0 3px 8px rgba(0,0,0,0.2));
            transition: transform var(--transition-fast);
          }
          
          .sidebar-logo-img:hover {
            transform: scale(1.05);
          }

          .sidebar-logo-text {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .sidebar-logo-name {
            font-size: 0.95rem;
            font-weight: 700;
            color: var(--sidebar-text-active);
            white-space: nowrap;
            letter-spacing: -0.02em;
            margin-bottom: 2px;
          }

          .sidebar-logo-sub {
            font-size: 0.65rem;
            color: var(--sidebar-text);
            white-space: nowrap;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .sidebar-toggle {
            position: absolute;
            top: 28px;
            right: -12px;
            width: 24px;
            height: 24px;
            background: var(--sidebar-bg);
            border: 1px solid var(--sidebar-border);
            border-radius: 50%;
            color: var(--sidebar-text);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 50;
            transition: color var(--transition-fast), background var(--transition-fast);
          }

          .sidebar-toggle:hover {
            color: var(--sidebar-text-active);
            background: var(--sidebar-hover);
          }

          .sidebar-nav {
            flex: 1;
            padding: 16px 10px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            overflow-y: auto;
            overflow-x: hidden;
          }

          .sidebar-section-label {
            font-size: 0.6rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--sidebar-text);
            opacity: 0.5;
            padding: 8px 8px 4px;
            display: block;
          }

          .sidebar-link {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 10px;
            border-radius: var(--border-radius-sm);
            color: var(--sidebar-text);
            text-decoration: none;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all var(--transition-fast);
            white-space: nowrap;
            overflow: hidden;
          }

          .sidebar-link:hover {
            color: var(--sidebar-text-active);
            background: var(--sidebar-hover);
          }

          .sidebar-link--active {
            color: var(--sidebar-accent) !important;
            background: var(--sidebar-active-bg) !important;
            font-weight: 600;
          }

          .sidebar-link svg {
            flex-shrink: 0;
          }

          .sidebar-bottom {
            padding: 10px 10px 16px;
            border-top: 1px solid var(--sidebar-border);
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .sidebar-user {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 8px;
            margin-top: 8px;
            border-radius: var(--border-radius-sm);
            background: rgba(255, 255, 255, 0.04);
            overflow: hidden;
          }

          .sidebar-user-avatar {
            width: 32px;
            height: 32px;
            background: var(--sidebar-accent);
            color: #000;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.8rem;
            flex-shrink: 0;
          }

          .sidebar-user-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-width: 0;
          }

          .sidebar-user-name {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--sidebar-text-active);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .sidebar-user-role {
            font-size: 0.65rem;
            color: var(--sidebar-text);
            text-transform: capitalize;
          }

          .sidebar-logout {
            background: none;
            border: none;
            color: var(--sidebar-text);
            cursor: pointer;
            padding: 4px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            transition: color var(--transition-fast);
            flex-shrink: 0;
          }

          .sidebar-logout:hover {
            color: var(--accent-danger);
          }

          @media (max-width: 768px) {
            .sidebar {
              position: fixed;
              left: 0;
              width: min(85vw, 300px);
              min-width: min(85vw, 300px);
              transform: translateX(-100%);
              box-shadow: var(--shadow-lg);
            }

            .sidebar--mobile-open {
              transform: translateX(0);
            }

            .sidebar-logo {
              padding: 24px 8px 20px;
              padding-right: 56px;
            }

            .sidebar-logo-img {
              width: 52px;
            }

            .sidebar-logo-name {
              font-size: 0.9rem;
            }

            .sidebar-toggle {
              top: 20px;
              right: 12px;
              width: 32px;
              height: 32px;
              border-radius: 8px;
            }

            .sidebar-nav {
              padding: 12px 8px;
              gap: 1px;
            }

            .sidebar-bottom {
              padding: 12px 8px 16px;
            }
          }

          @media (max-width: 640px) {
            .sidebar {
              width: min(90vw, 280px);
              min-width: min(90vw, 280px);
            }

            .sidebar-logo {
              padding: 20px 8px 16px;
            }

            .sidebar-logo-img {
              width: 48px;
            }

            .sidebar-logo-name {
              font-size: 0.85rem;
            }

            .sidebar-logo-sub {
              font-size: 0.6rem;
            }
          }

          @media (max-width: 480px) {
            .sidebar {
              width: min(92vw, 260px);
              min-width: min(92vw, 260px);
            }

            .sidebar-logo {
              padding: 16px 8px 12px;
              gap: 8px;
            }

            .sidebar-logo-img {
              width: 44px;
            }

            .sidebar-logo-name {
              font-size: 0.8rem;
              margin-bottom: 0;
            }

            .sidebar-logo-sub {
              font-size: 0.55rem;
            }

            .sidebar-toggle {
              top: 16px;
              right: 10px;
              width: 28px;
              height: 28px;
            }

            .sidebar-nav {
              padding: 8px 6px;
            }

            .sidebar-section-label {
              font-size: 0.7rem;
              padding: 6px 8px;
            }

            .sidebar-link {
              padding: 10px 8px;
              font-size: 0.85rem;
              gap: 8px;
            }

            .sidebar-user-avatar {
              width: 32px;
              height: 32px;
              font-size: 0.8rem;
            }
          }

          @media (max-width: 380px) {
            .sidebar {
              width: min(95vw, 240px);
              min-width: min(95vw, 240px);
            }

            .sidebar-logo-img {
              width: 40px;
            }

            .sidebar-toggle {
              width: 24px;
              height: 24px;
            }

            .sidebar-link {
              padding: 8px 6px;
            }
          }
        `}</style>
      </aside>
    </>
  );
}
