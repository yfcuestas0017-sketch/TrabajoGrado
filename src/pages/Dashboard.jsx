import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';

export default function Dashboard() {
  const { user } = useAuth();

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

      <AnalyticsDashboard />

      </DashboardLayout>
  );
}
