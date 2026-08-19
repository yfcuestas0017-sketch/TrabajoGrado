import { CalendarDays, GraduationCap, RefreshCw, Save, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import './PageComing.css';

export function UsuariosPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ semesters: [], students: [] });
  const [dates, setDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSettings = async () => {
    setLoading(true); setError('');
    try {
      const data = await api.getAcademicSettings(user?.id);
      setSettings(data);
      setDates(Object.fromEntries((data.semesters || []).map((semester) => [semester.semester_id, {
        startDate: semester.start_date ? String(semester.start_date).slice(0, 10) : '',
        endDate: semester.end_date ? String(semester.end_date).slice(0, 10) : '',
      }])));
    } catch (err) { setError(err.message || 'No fue posible cargar la configuración académica.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user?.id) loadSettings(); }, [user?.id]);

  const saveDates = async (semesterId) => {
    setSaving(`dates-${semesterId}`); setMessage(''); setError('');
    try {
      await api.updateSemesterDates(user.id, semesterId, dates[semesterId]?.startDate, dates[semesterId]?.endDate);
      setMessage('Fechas académicas guardadas correctamente.');
      await loadSettings();
    } catch (err) { setError(err.message || 'No fue posible guardar las fechas.'); }
    finally { setSaving(''); }
  };

  const applyPromotion = async () => {
    setSaving('promotion'); setMessage(''); setError('');
    try {
      const result = await api.applyAcademicPromotion(user.id);
      setMessage(result.promoted > 0 ? `Se promovieron ${result.promoted} estudiantes. Sus proyectos se conservaron.` : 'No hay estudiantes pendientes de promoción.');
      await loadSettings();
    } catch (err) { setError(err.message || 'No fue posible aplicar la promoción.'); }
    finally { setSaving(''); }
  };

  return (
    <DashboardLayout title="Usuarios" subtitle="Gestión de cuentas y calendario académico">
      <div className="academic-admin-page">
        <div className="academic-admin-header"><div><span className="page-coming-eyebrow">Administración académica</span><h2>Semestres y promoción</h2><p>Define la fecha de fin de cada semestre. Al aplicar la promoción, el estudiante avanza de 8° a 9° o de 9° a 10° y conserva el mismo proyecto.</p></div><Button variant="primary" icon={RefreshCw} loading={saving === 'promotion'} onClick={applyPromotion}>Aplicar promoción</Button></div>
        {message && <div className="academic-admin-message">{message}</div>}
        {error && <div className="academic-admin-error">{error}</div>}
        <section className="academic-admin-card"><div className="academic-admin-card-title"><CalendarDays size={18} /><h3>Calendario de semestres</h3></div>{loading ? <p>Cargando...</p> : <div className="academic-semester-list">{settings.semesters.map((semester) => <div className="academic-semester-row" key={semester.semester_id}><div><strong>{semester.semester_number}° semestre</strong><span>La promoción se habilita después de la fecha de fin.</span></div><input type="date" value={dates[semester.semester_id]?.startDate || ''} onChange={(event) => setDates((current) => ({ ...current, [semester.semester_id]: { ...current[semester.semester_id], startDate: event.target.value } }))} aria-label={`Inicio ${semester.semester_number} semestre`} /><input type="date" value={dates[semester.semester_id]?.endDate || ''} onChange={(event) => setDates((current) => ({ ...current, [semester.semester_id]: { ...current[semester.semester_id], endDate: event.target.value } }))} aria-label={`Fin ${semester.semester_number} semestre`} /><button type="button" onClick={() => saveDates(semester.semester_id)} disabled={saving === `dates-${semester.semester_id}`} title="Guardar fechas"><Save size={16} /></button></div>)}</div>}</section>
        <section className="academic-admin-card"><div className="academic-admin-card-title"><GraduationCap size={18} /><h3>Estudiantes registrados</h3></div><div className="academic-student-list">{settings.students.map((student) => <div className="academic-student-row" key={student.user_id}><span>{student.full_name}<small>{student.email}</small></span><strong>{student.semester_number ? `${student.semester_number}°` : 'Sin semestre'}</strong><span>{student.code || 'Sin proyecto'}</span></div>)}</div></section>
      </div>
    </DashboardLayout>
  );
}

export default UsuariosPage;
