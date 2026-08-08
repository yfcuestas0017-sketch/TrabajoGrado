import { Users } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import './PageComing.css';

export function UsuariosPage() {
  return (
    <DashboardLayout title="Usuarios" subtitle="Gestion de cuentas y permisos">
      <div className="page-coming">
        <div className="page-coming-icon">
          <Users size={36} />
        </div>
        <h2>Gestion de Usuarios</h2>
        <p>
          Los usuarios, roles y permisos se cargaran desde la base de datos cuando la capa de
          administracion este integrada.
        </p>
        <Button variant="primary">Administrar usuarios</Button>
      </div>
    </DashboardLayout>
  );
}

export default UsuariosPage;
