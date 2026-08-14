import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Lock,
  Mail,
  Pencil,
  Save,
  User,
  X,
} from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import './Ajustes.css';

function InfoRow({ icon: Icon, label, value, muted }) {
  return (
    <div className="info-row">
      <div className="info-icon">
        <Icon size={15} />
      </div>
      <div className="info-content">
        <span className="info-label">{label}</span>
        <span className={`info-value${muted ? ' info-value--muted' : ''}`}>
          {value || '—'}
        </span>
      </div>
    </div>
  );
}

export default function AjustesPage() {
  const { user, updateUser } = useAuth();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [programs, setPrograms] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    async function load() {
      setLoadingProfile(true);
      try {
        const catalogs = await api.getCatalogs();
        setPrograms(catalogs.programs || []);
        setSemesters(catalogs.semesters || []);
      } catch (err) {
        console.error('Error cargando ajustes:', err);
      } finally {
        setLoadingProfile(false);
      }
    }
    load();
  }, [user?.id]);

  const startEdit = () => {
    setForm({
      fullName: user?.name || '',
      programId: String(user?.programId || ''),
    });
    setSaveError('');
    setSaveSuccess('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaveError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setSaveError('El nombre no puede estar vacío.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      updateUser({ name: form.fullName.trim(), programId: Number(form.programId) || null });
      setSaveSuccess('Perfil actualizado correctamente.');
      setEditing(false);
    } catch (err) {
      setSaveError(err.message || 'Error al guardar cambios.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = user?.name || 'Usuario';
  const displayEmail = user?.email || '';
  const programName =
    user?.programName ||
    programs.find((p) => p.program_id === user?.programId)?.name ||
    'Sin programa';

  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <DashboardLayout title="Ajustes" subtitle="Administra tu información personal">
      <div className="settings-page">
        {/* HEADER PERFIL */}
        <div className="settings-hero">
          <div className="settings-hero-copy">
            <span className="settings-hero-eyebrow">Administración de cuenta</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="profile-avatar">{initials || <User size={28} />}</div>
              <div className="profile-meta">
                <h2 className="profile-name">{displayName}</h2>
                <p className="profile-email">{displayEmail}</p>
                <div className="profile-badges">
                  <span className="profile-badge">{user?.role || 'Estudiante'}</span>
                  {programName !== 'Sin programa' && (
                    <span className="profile-badge profile-badge--muted">{programName}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {!editing && (
            <div className="profile-edit-btn">
              <Button variant="primary" icon={Pencil} onClick={startEdit}>
                Editar perfil
              </Button>
            </div>
          )}
        </div>

        <div className="settings-body">
          {/* PANEL IZQUIERDO */}
          <div className="settings-main">
            <div className="settings-card">
              <div className="card-header">
                <h3 className="card-title">Información de cuenta</h3>
              </div>

              {loadingProfile ? (
                <div className="settings-loading">Cargando perfil...</div>
              ) : (
                <div className="info-list">
                  <InfoRow icon={User} label="Nombre completo" value={displayName} />
                  <InfoRow icon={Mail} label="Correo electrónico" value={displayEmail} muted />
                  <InfoRow icon={Lock} label="Contraseña" value="••••••••••" muted />
                  <InfoRow icon={GraduationCap} label="Programa académico" value={programName} />
                  <InfoRow icon={User} label="Rol" value={user?.role || 'Estudiante'} />
                </div>
              )}
            </div>

            {/* FORMULARIO DE EDICIÓN */}
            {editing && (
              <div className="settings-card settings-card--edit">
                <div className="card-header">
                  <h3 className="card-title">Editar perfil</h3>
                  <span className="card-subtitle">
                    El correo electrónico no puede modificarse desde aquí.
                  </span>
                </div>

                {saveError && (
                  <div className="settings-alert settings-alert--error">
                    <AlertCircle size={15} />
                    <span>{saveError}</span>
                  </div>
                )}
                {saveSuccess && (
                  <div className="settings-alert settings-alert--success">
                    <CheckCircle2 size={15} />
                    <span>{saveSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleSave} className="edit-form">
                  <div className="field">
                    <label className="field-label">Nombre completo *</label>
                    <input
                      type="text"
                      required
                      className="field-input"
                      value={form.fullName}
                      onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                      placeholder="Tu nombre completo"
                      minLength={3}
                    />
                  </div>

                  <div className="field">
                    <label className="field-label">
                      Correo electrónico
                      <span className="field-lock">🔒 No editable</span>
                    </label>
                    <input
                      type="email"
                      className="field-input field-input--readonly"
                      value={displayEmail}
                      readOnly
                      tabIndex={-1}
                    />
                  </div>

                  <div className="field">
                    <label className="field-label">Programa académico</label>
                    <div className="select-wrap">
                      <select
                        className="field-input field-select"
                        value={form.programId}
                        onChange={(e) => setForm((p) => ({ ...p, programId: e.target.value }))}
                      >
                        <option value="">— Sin programa —</option>
                        {programs.map((p) => (
                          <option key={p.program_id} value={p.program_id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="select-chevron" />
                    </div>
                  </div>

                  <div className="edit-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      icon={X}
                      onClick={cancelEdit}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      icon={Save}
                      loading={saving}
                    >
                      {saving ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* PANEL DERECHO */}
          <aside className="settings-aside">
            <div className="settings-card summary-card">
              <div className="card-header">
                <h3 className="card-title">Resumen de cuenta</h3>
              </div>
              <div className="summary-list">
                <div className="summary-row">
                  <span className="summary-key">Estado</span>
                  <span className="summary-val summary-val--active">Activo</span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Base de datos</span>
                  <span className="summary-val">BaseDatosGrado</span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Programa</span>
                  <span className="summary-val">{programName}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Rol</span>
                  <span className="summary-val">{user?.role || 'Estudiante'}</span>
                </div>
              </div>
            </div>

            <div className="settings-card security-card">
              <div className="card-header">
                <h3 className="card-title">Seguridad</h3>
              </div>
              <p className="security-note">
                Conectado directamente a la base de datos PostgreSQL institucional (<strong>BaseDatosGrado</strong>).
              </p>
              <div className="security-badge">
                <Lock size={13} />
                <span>BaseDatosGrado PostgreSQL</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
