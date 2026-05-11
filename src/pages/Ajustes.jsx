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
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { getSupabaseClient } from '../lib/supabase/client';
import { hasSupabaseConfig } from '../lib/supabase/config';
import { fetchPrograms, fetchSemesters } from '../lib/supabase/registerUser';

// ─── helpers ──────────────────────────────────────────────────────────────────

const FALLBACK_PROGRAMS = [
  { program_id: 1, name: 'Ingeniería de Sistemas' },
  { program_id: 2, name: 'Psicología' },
];
// semester_id es SERIAL en la DB (1,2,3…). semester_number es el número visible (8,9,10).
// Estos fallbacks solo se usan si Supabase no responde.
const FALLBACK_SEMESTERS = [
  { semester_id: 1, semester_number: 8 },
  { semester_id: 2, semester_number: 9 },
  { semester_id: 3, semester_number: 10 },
];

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

// ─── componente principal ──────────────────────────────────────────────────────

export default function AjustesPage() {
  const { user, updateUser } = useAuth();

  // ── datos extendidos desde Supabase ─────────────────────────────
  const [profile, setProfile] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // ── catálogos ────────────────────────────────────────────────────
  const [programs, setPrograms] = useState(FALLBACK_PROGRAMS);
  const [semesters, setSemesters] = useState(FALLBACK_SEMESTERS);
  const [roles, setRoles] = useState([]);

  // ── edición ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // ── carga inicial ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !hasSupabaseConfig) {
      setLoadingProfile(false);
      return;
    }

    const supabase = getSupabaseClient();

    async function load() {
      setLoadingProfile(true);

      const [
        { data: profileData },
        { data: studentRow },
        { data: roleRows },
        progsData,
        semsData,
      ] = await Promise.all([
        supabase
          .from('users')
          .select('user_id, full_name, email, program_id, programs(name)')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('students')
          .select(
            'student_id, semester_id, curriculum_id, semesters(semester_number), academic_curricula(version, effective_year, status)',
          )
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role_id, roles(name)')
          .eq('user_id', user.id),
        fetchPrograms().catch(() => FALLBACK_PROGRAMS),
        fetchSemesters().catch(() => FALLBACK_SEMESTERS),
      ]);

      setProfile(profileData);
      setStudentData(studentRow);
      setRoles(roleRows?.map((r) => r.roles?.name).filter(Boolean) ?? []);
      setPrograms(progsData.length > 0 ? progsData : FALLBACK_PROGRAMS);
      setSemesters(semsData.length > 0 ? semsData : FALLBACK_SEMESTERS);
      setLoadingProfile(false);
    }

    load();
  }, [user?.id]);

  // ── iniciar edición ───────────────────────────────────────────────
  const startEdit = () => {
    setForm({
      fullName: profile?.full_name || user?.name || '',
      programId: String(profile?.program_id || ''),
      semesterId: String(studentData?.semester_id || ''),
    });
    setSaveError('');
    setSaveSuccess('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaveError('');
  };

  // ── guardar cambios en Supabase ───────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!hasSupabaseConfig) {
      setSaveError('Sin conexión con Supabase. Verifica tu configuración.');
      return;
    }
    if (!form.fullName.trim()) {
      setSaveError('El nombre no puede estar vacío.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    const supabase = getSupabaseClient();
    const errors = [];

    // ── 1. Actualizar public.users ──────────────────────────────
    const { data: updatedRows, error: userErr } = await supabase
      .from('users')
      .update({
        full_name: form.fullName.trim(),
        program_id: form.programId ? Number(form.programId) : null,
      })
      .eq('user_id', user.id)
      .select('user_id');   // si RLS bloquea, devuelve [] sin error

    if (userErr) {
      console.error('[Ajustes] Error al actualizar users:', userErr);
      errors.push('Perfil: ' + (userErr.message || 'error desconocido'));
    } else if (!updatedRows || updatedRows.length === 0) {
      // RLS activo sin política UPDATE → 0 filas afectadas, sin error explícito
      console.warn('[Ajustes] UPDATE en users no afectó ninguna fila. ¿Falta política RLS?');
      errors.push(
        'No se actualizó el perfil. Falta política RLS en public.users. ' +
        'Agrega en Supabase: ALTER TABLE public.users ENABLE ROW LEVEL SECURITY; ' +
        'CREATE POLICY "own_update" ON public.users FOR UPDATE USING (auth.uid() = user_id);',
      );
    }

    // ── 2. Semestre → UPDATE o INSERT en public.students ───────
    if (form.semesterId) {
      const semId = Number(form.semesterId);

      if (studentData?.student_id) {
        // Ya existe fila → UPDATE
        const { error: stuErr } = await supabase
          .from('students')
          .update({ semester_id: semId })
          .eq('student_id', studentData.student_id);

        if (stuErr) {
          console.error('[Ajustes] Error al actualizar students:', stuErr);
          errors.push('Semestre: ' + stuErr.message);
        }
      } else {
        // No existe fila → intentar INSERT con curriculum resuelto
        // Buscar cualquier curriculum del programa elegido
        const pid = form.programId ? Number(form.programId) : null;
        let currId = null;

        if (pid) {
          const { data: currs } = await supabase
            .from('academic_curricula')
            .select('curriculum_id')
            .eq('program_id', pid)
            .order('effective_year', { ascending: false })
            .limit(1);
          currId = currs?.[0]?.curriculum_id ?? null;
        }

        if (currId) {
          const { error: insErr } = await supabase.from('students').insert({
            user_id: user.id,
            semester_id: semId,
            curriculum_id: currId,
          });
          if (insErr) {
            console.error('[Ajustes] Error al insertar en students:', insErr);
            errors.push('Semestre (insert): ' + insErr.message);
          }
        } else {
          console.warn('[Ajustes] No se encontró curriculum_id para crear fila en students.');
          errors.push(
            'No se guardó el semestre porque no hay un currículo activo para este programa. ' +
            'Agrega currículos en la tabla academic_curricula.',
          );
        }
      }
    }

    // ── 3. Refrescar datos locales ──────────────────────────────
    const { data: updatedProfile } = await supabase
      .from('users')
      .select('user_id, full_name, email, program_id, programs(name)')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: updatedStudent } = await supabase
      .from('students')
      .select('student_id, semester_id, curriculum_id, semesters(semester_number), academic_curricula(version, effective_year, status)')
      .eq('user_id', user.id)
      .maybeSingle();

    setProfile(updatedProfile);
    setStudentData(updatedStudent);

    // ── 4. Actualizar AuthContext ───────────────────────────────
    if (!errors.length) {
      updateUser({ name: form.fullName.trim(), programId: Number(form.programId) || null });
    }

    setSaving(false);

    if (errors.length > 0) {
      setSaveError(errors.join('\n'));
    } else {
      setSaveSuccess('Perfil actualizado correctamente.');
      setEditing(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────
  const displayName = profile?.full_name || user?.name || 'Usuario';
  const displayEmail = profile?.email || user?.email || '';
  const programName =
    profile?.programs?.name ||
    programs.find((p) => p.program_id === profile?.program_id)?.name ||
    'Sin programa';
  const semesterNum = studentData?.semesters?.semester_number;
  const curriculumLabel = studentData?.academic_curricula
    ? `${studentData.academic_curricula.version} (${studentData.academic_curricula.effective_year})`
    : null;

  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <DashboardLayout title="Ajustes" subtitle="Administra tu información personal">
      <div className="settings-page">

        {/* ── HEADER PERFIL ─────────────────────────────────────── */}
        <div className="settings-hero">
          <div className="settings-hero-copy">
            <span className="settings-hero-eyebrow">Administración de cuenta</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="profile-avatar">{initials || <User size={28} />}</div>
              <div className="profile-meta">
                <h2 className="profile-name">{displayName}</h2>
                <p className="profile-email">{displayEmail}</p>
                <div className="profile-badges">
                  {roles.length > 0
                    ? roles.map((r) => (
                        <span key={r} className="profile-badge">{r}</span>
                      ))
                    : <span className="profile-badge">Estudiante</span>}
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

          {/* ── PANEL IZQUIERDO: datos ──────────────────────────── */}
          <div className="settings-main">

            {/* Datos de cuenta (solo lectura parcial) */}
            <div className="settings-card">
              <div className="card-header">
                <h3 className="card-title">Información de cuenta</h3>
              </div>

              {loadingProfile ? (
                <div className="settings-loading">Cargando perfil...</div>
              ) : (
                <div className="info-list">
                  <InfoRow icon={User}  label="Nombre completo"    value={profile?.full_name || user?.name} />
                  <InfoRow icon={Mail}  label="Correo electrónico" value={displayEmail} muted />
                  <InfoRow icon={Lock}  label="Contraseña"         value="••••••••••" muted />
                  <InfoRow icon={GraduationCap} label="Programa académico" value={programName} />
                  <InfoRow
                    icon={GraduationCap}
                    label="Semestre"
                    value={semesterNum ? `Semestre ${semesterNum}` : null}
                  />
                  {curriculumLabel && (
                    <InfoRow icon={GraduationCap} label="Plan curricular" value={curriculumLabel} />
                  )}
                  <InfoRow
                    icon={User}
                    label="Rol(es)"
                    value={roles.length > 0 ? roles.join(', ') : 'Estudiante'}
                  />
                </div>
              )}
            </div>

            {/* ── FORMULARIO DE EDICIÓN ──────────────────────────── */}
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

                  {/* Nombre */}
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

                  {/* Correo — solo lectura */}
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

                  {/* Programa */}
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

                  {/* Semestre */}
                  <div className="field">
                    <label className="field-label">Semestre actual</label>
                    <div className="select-wrap">
                      <select
                        className="field-input field-select"
                        value={form.semesterId}
                        onChange={(e) => setForm((p) => ({ ...p, semesterId: e.target.value }))}
                      >
                        <option value="">— Sin semestre —</option>
                        {semesters.map((s) => (
                          <option key={s.semester_id} value={s.semester_id}>
                            Semestre {s.semester_number}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="select-chevron" />
                    </div>
                  </div>

                  {/* Acciones */}
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

          {/* ── PANEL DERECHO: resumen ──────────────────────────── */}
          <aside className="settings-aside">

            {/* Tarjeta resumen */}
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
                  <span className="summary-key">Modo auth</span>
                  <span className="summary-val">{user?.authMode || 'local'}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">Programa</span>
                  <span className="summary-val">{programName}</span>
                </div>
                {semesterNum && (
                  <div className="summary-row">
                    <span className="summary-key">Semestre</span>
                    <span className="summary-val">Semestre {semesterNum}</span>
                  </div>
                )}
                {curriculumLabel && (
                  <div className="summary-row">
                    <span className="summary-key">Currículo</span>
                    <span className="summary-val">{curriculumLabel}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span className="summary-key">Rol</span>
                  <span className="summary-val">{roles[0] || 'Estudiante'}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-key">ID</span>
                  <span className="summary-val summary-val--id">
                    {user?.id ? `${user.id.slice(0, 8)}…` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Nota de seguridad */}
            <div className="settings-card security-card">
              <div className="card-header">
                <h3 className="card-title">Seguridad</h3>
              </div>
              <p className="security-note">
                Para cambiar tu <strong>correo</strong> o <strong>contraseña</strong>,
                contacta al administrador del sistema o gestiona tu cuenta directamente
                desde el panel de Supabase.
              </p>
              <div className="security-badge">
                <Lock size={13} />
                <span>Datos gestionados por Supabase Auth</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        /* ── PAGE ──────────────────────────────────────────────── */
        .settings-page {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── HERO ──────────────────────────────────────────────── */
        .settings-hero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), transparent 58%),
            var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-xl);
          padding: 24px 26px;
          box-shadow: var(--shadow-sm);
        }

        .settings-hero-copy {
          max-width: 720px;
          min-width: 0;
          flex: 1;
        }

        .settings-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--accent-primary);
          margin-bottom: 12px;
        }

        .profile-avatar {
          width: 68px; height: 68px;
          flex-shrink: 0;
          background: var(--accent-primary);
          color: #000;
          border-radius: 20px;
          font-family: var(--font-display);
          font-size: 1.5rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px color-mix(in srgb, var(--accent-primary) 30%, transparent);
        }

        .profile-meta { flex: 1; min-width: 0; }

        .profile-name {
          font-family: var(--font-display);
          font-size: 1.45rem; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.03em;
          margin-bottom: 4px; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; line-height: 1.1;
        }

        .profile-email {
          font-size: 0.85rem; color: var(--text-muted);
          margin-bottom: 10px;
        }

        .profile-badges {
          display: flex; flex-wrap: wrap; gap: 6px;
        }

        .profile-badge {
          padding: 3px 10px; border-radius: 999px;
          font-size: 0.72rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
          background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
          color: var(--accent-primary);
        }

        .profile-badge--muted {
          background: var(--bg-primary);
          color: var(--text-secondary);
        }

        .profile-edit-btn { margin-left: auto; }

        .settings-body {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 20px;
          align-items: start;
        }

        .settings-main {
          display: flex; flex-direction: column; gap: 16px;
        }

        /* ── CARDS ─────────────────────────────────────────────── */
        .settings-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          padding: 20px 22px;
          box-shadow: var(--shadow-sm);
          animation: fadeIn 0.35s ease;
        }

        .settings-card--edit {
          border-color: color-mix(in srgb, var(--accent-primary) 30%, var(--border-color));
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 8%, transparent),
                      var(--shadow-sm);
        }

        .card-header { margin-bottom: 18px; }

        .card-title {
          font-family: var(--font-display);
          font-size: 1.05rem; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.02em;
          margin-bottom: 4px; line-height: 1.2;
        }

        .card-subtitle {
          font-size: 0.8rem; color: var(--text-muted);
        }

        /* ── INFO LIST ─────────────────────────────────────────── */
        .info-list { display: flex; flex-direction: column; gap: 0; }

        .info-row {
          display: flex; align-items: center; gap: 14px;
          padding: 13px 0;
          border-bottom: 1px solid var(--border-color);
          transition: background var(--transition-fast);
        }

        .info-row:last-child { border-bottom: none; }

        .info-icon {
          width: 32px; height: 32px; flex-shrink: 0;
          background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
          color: var(--accent-primary);
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
        }

        .info-content { flex: 1; min-width: 0; }

        .info-label {
          display: block;
          font-size: 0.7rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--text-muted); margin-bottom: 2px;
        }

        .info-value {
          font-size: 0.9rem; font-weight: 600;
          color: var(--text-primary);
        }

        .info-value--muted {
          color: var(--text-muted); font-weight: 400;
        }

        .settings-loading {
          padding: 24px 0;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.88rem;
        }

        /* ── EDIT FORM ─────────────────────────────────────────── */
        .edit-form {
          display: flex; flex-direction: column; gap: 14px;
        }

        .field { display: flex; flex-direction: column; gap: 5px; }

        .field-label {
          font-size: 0.78rem; font-weight: 600;
          color: var(--text-primary); letter-spacing: -0.01em;
          display: flex; align-items: center; gap: 8px;
        }

        .field-lock {
          font-size: 0.72rem; font-weight: 400;
          color: var(--text-muted);
        }

        .field-input {
          width: 100%; padding: 10px 13px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          background: var(--bg-secondary);
          font-size: 0.88rem; font-family: var(--font-body);
          color: var(--text-primary);
          transition: all var(--transition-fast); outline: none;
        }

        .field-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 14%, transparent);
        }

        .field-input--readonly {
          background: var(--bg-primary);
          color: var(--text-muted);
          cursor: not-allowed;
        }

        .field-input--readonly:focus {
          border-color: var(--border-color);
          box-shadow: none;
        }

        .select-wrap { position: relative; }
        .field-select { appearance: none; padding-right: 34px; cursor: pointer; }
        .select-chevron {
          position: absolute; right: 11px; top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted); pointer-events: none;
        }

        .edit-actions {
          display: flex; justify-content: flex-end; gap: 10px;
          padding-top: 6px;
        }

        /* ── ALERTS ────────────────────────────────────────────── */
        .settings-alert {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 13px; border-radius: var(--border-radius-sm);
          font-size: 0.84rem; margin-bottom: 6px;
        }

        .settings-alert--error {
          background: color-mix(in srgb, var(--accent-danger) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent-danger) 25%, transparent);
          color: var(--accent-danger);
        }

        .settings-alert--success {
          background: color-mix(in srgb, var(--accent-success) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent-success) 25%, transparent);
          color: var(--accent-success);
        }

        /* ── ASIDE ─────────────────────────────────────────────── */
        .settings-aside {
          display: flex; flex-direction: column; gap: 16px;
        }

        /* Summary card */
        .summary-list { display: flex; flex-direction: column; gap: 0; }

        .summary-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid var(--border-color);
          font-size: 0.84rem;
        }

        .summary-row:last-child { border-bottom: none; }

        .summary-key { color: var(--text-muted); font-size: 0.78rem; }

        .summary-val {
          font-weight: 600; color: var(--text-primary);
          font-size: 0.82rem;
        }

        .summary-val--active {
          color: var(--accent-success);
        }

        .summary-val--id {
          font-family: monospace;
          font-size: 0.76rem; color: var(--text-muted);
        }

        /* Security card */
        .security-note {
          font-size: 0.83rem; color: var(--text-secondary);
          line-height: 1.65; margin-bottom: 14px;
        }

        .security-badge {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.75rem; color: var(--text-muted);
          padding: 6px 10px;
          background: var(--bg-primary);
          border-radius: var(--border-radius-sm);
          width: fit-content;
        }

        @media (max-width: 1024px) {
          .settings-body {
            grid-template-columns: 1fr 280px;
          }

          .settings-hero {
            padding: 22px 24px;
            align-items: center;
          }

          .profile-name {
            font-size: 1.3rem;
          }

          .settings-card {
            padding: 18px 20px;
          }
        }

        @media (max-width: 900px) {
          .settings-body {
            grid-template-columns: 1fr;
          }

          .settings-aside {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .profile-edit-btn {
            margin-left: 0;
          }
        }

        @media (max-width: 720px) {
          .settings-hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 20px;
          }

          .settings-hero-copy {
            width: 100%;
          }

          .profile-avatar {
            width: 60px;
            height: 60px;
            border-radius: 18px;
            font-size: 1.3rem;
          }

          .profile-name {
            white-space: normal;
            font-size: 1.2rem;
          }

          .settings-aside {
            grid-template-columns: 1fr;
          }

          .edit-actions {
            justify-content: stretch;
            flex-direction: column-reverse;
          }

          .edit-actions .btn {
            width: 100%;
          }
        }

        @media (max-width: 520px) {
          .settings-page {
            gap: 16px;
          }

          .settings-hero {
            padding: 18px 16px;
            border-radius: var(--border-radius-lg);
          }

          .profile-avatar {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            font-size: 1.1rem;
          }

          .profile-name {
            font-size: 1.08rem;
          }

          .settings-card {
            padding: 16px;
            border-radius: var(--border-radius-md);
          }

          .info-row {
            gap: 12px;
          }

          .info-icon {
            width: 30px;
            height: 30px;
            border-radius: 8px;
          }

          .field-input {
            padding: 9px 12px;
          }

          .profile-edit-btn {
            width: 100%;
          }
          .profile-edit-btn > * { width: 100%; }
        }

        @media (max-width: 380px) {
          .settings-hero {
            padding: 14px 12px;
          }

          .profile-badges {
            gap: 4px;
          }

          .profile-badge {
            font-size: 0.68rem;
          }

          .card-title {
            font-size: 0.95rem;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
