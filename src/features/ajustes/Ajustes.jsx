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
import { getSupabaseClient } from '../../lib/supabase/client';
import { hasSupabaseConfig } from '../../lib/supabase/config';
import { fetchPrograms, fetchSemesters } from '../../lib/supabase/registerUser';
import './Ajustes.css';

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

    </DashboardLayout>
  );
}
