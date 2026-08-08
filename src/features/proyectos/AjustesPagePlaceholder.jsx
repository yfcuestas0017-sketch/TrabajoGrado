import { Settings } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import './PageComing.css';

// Nota: este componente no está enrutado en App.jsx (la app usa
// features/ajustes/Ajustes.jsx para la ruta /ajustes). Se conserva tal
// cual existía en el Proyectos.jsx original para no perder código.
export function AjustesPage() {
  return (
    <DashboardLayout title="Ajustes" subtitle="Configuracion de la plataforma">
      <div className="page-coming">
        <div className="page-coming-icon">
          <Settings size={36} />
        </div>
        <h2>Configuracion</h2>
        <p>
          La configuracion funcional del sistema se conectara cuando tengamos persistencia real y
          servicios disponibles.
        </p>
        <Button variant="primary">Abrir configuracion</Button>
      </div>
    </DashboardLayout>
  );
}

export default AjustesPage;
