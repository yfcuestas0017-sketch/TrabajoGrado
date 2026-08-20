import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
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
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/proyectos', label: 'Gestion de Proyectos', icon: FolderOpen },
  { to: '/subir', label: 'Gestion de Docente', icon: Upload },
  { to: '/facultades', label: 'Banco de Proyectos', icon: BookOpen },
];

const NAV_BOTTOM = [
  { to: '/reportes', label: 'Generar reportes', icon: FileSpreadsheet },
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

  const canAccessAdmin = ['admin', 'administrador'].includes(user?.role?.toLowerCase()) || user?.authMode === 'local';
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

      </aside>
    </>
  );
}
