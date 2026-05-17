import { BookOpen } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import BancoAnalytics from '../components/analytics/BancoAnalytics';

export default function BancoProyectos() {
  return (
    <DashboardLayout title="Banco de Proyectos" subtitle="Analítica académica y exploración de proyectos">
      <BancoAnalytics />
    </DashboardLayout>
  );
}
