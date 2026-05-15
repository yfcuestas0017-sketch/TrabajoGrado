import { useEffect, useState, useCallback } from 'react';
import { X, ChevronDown, Plus, Pencil, Trash2, Save, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase/client';

// ── UTILIDAD ─────────────────────────────────────────────
function generatePrefix(lineName) {
  if (!lineName) return 'PR';
  const ignoredWords = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'para', 'con', 'en']);
  const words = lineName.split(/\s+/);
  const letters = words
    .filter(w => !ignoredWords.has(w.toLowerCase()))
    .map(w => w.charAt(0).toUpperCase());
  return letters.join('');
}

function Avatar({ name, size = 32 }) {
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'color-mix(in srgb, var(--accent-primary) 18%, transparent)',
      color: 'var(--accent-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
export default function EditProjectModal({ project, statuses, modalities, lines, sublines, onClose, onSaved, user }) {
  // ── form básico ─────────────────────────────────────────
  const [form, setForm] = useState({
    title: project.title || '',
    code: project.code || '',
    statusId: project.statusId || '',
    modalityId: project.modalityId || '',
    lineId: project.lineId || '',
    sublineId: project.sublineId || '',
    letterLink: project.letterLink || '',
    period: '',
    objectives: '',
    endDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // ── integrantes ──────────────────────────────────────────
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantRole, setNewParticipantRole] = useState('coautor');
  const [verifyingParticipant, setVerifyingParticipant] = useState(false);
  const [participantError, setParticipantError] = useState('');
  const [editingParticipant, setEditingParticipant] = useState(null); 

  // ── asesor ───────────────────────────────────────────────
  const [selectedAdvisorId, setSelectedAdvisorId] = useState('');
  const [advisorError, setAdvisorError] = useState('');
  const [advisorName, setAdvisorName] = useState('');
  const [addingAdvisor, setAddingAdvisor] = useState(false);

  // ── acta ─────────────────────────────────────────────────
  const [actaLink, setActaLink] = useState('');
  const [actaDate, setActaDate] = useState('');
  const [savingActa, setSavingActa] = useState(false);

  // ── historial ────────────────────────────────────────────
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const supabase = getSupabaseClient();

  // ── sublines filtradas ───────────────────────────────────
  const filteredSublines = form.lineId
    ? sublines.filter(s => String(s.research_line_id) === String(form.lineId))
    : sublines;

  // ── cargar participantes ─────────────────────────────────
  const fetchParticipants = useCallback(async () => {
    setLoadingParticipants(true);
    const { data } = await supabase
      .from('user_projects')
      .select('user_id, project_role, users(full_name, email)')
      .eq('project_id', project.id);
    setParticipants(
      (data || []).map(r => ({
        userId: r.user_id,
        role: r.project_role,
        name: r.users?.full_name || '—',
        email: r.users?.email || '—',
      }))
    );
    // Detectar asesor actual
    const advisor = (data || []).find(r => r.project_role === 'asesor');
    if (advisor) setSelectedAdvisorId(advisor.user_id);
    setLoadingParticipants(false);
  }, [project.id]);




  // ── cargar historial ─────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('project_histories')
      .select('project_history_id, history:histories(description, modified_field, old_value, new_value, change_type, changed_at)')
      .eq('project_id', project.id)
      .order('project_history_id', { ascending: false });

    setHistory(
      (data || []).map(row => {
        const h = row.history || {};
        return {
          id: row.project_history_id,
          title: h.description || 'Actualización registrada',
          detail: h.modified_field
            ? `${h.modified_field}: ${h.old_value ?? '-'} → ${h.new_value ?? '-'}`
            : h.change_type || 'Actualización',
          date: h.changed_at ? new Date(h.changed_at).toLocaleDateString('es-CO') : 'Sin fecha',
          field: h.modified_field,
          oldVal: h.old_value,
          newVal: h.new_value,
        };
      })
    );
    setLoadingHistory(false);
  }, [project.id]);

  useEffect(() => {
    fetchParticipants();
    fetchHistory();
  }, [fetchParticipants, fetchHistory]);

  // ── guardar proyecto base ────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('El título es obligatorio.'); return; }
    if (!form.statusId || !form.modalityId) { setFormError('Selecciona estado y modalidad.'); return; }
    setSaving(true);
    setFormError('');
    const payload = {
      title: form.title.trim(),
      code: form.code.trim() || null,
      status_id: Number(form.statusId) || null,
      modality_id: Number(form.modalityId) || null,
      research_line_id: form.lineId ? Number(form.lineId) : null,
      research_subline_id: form.sublineId ? Number(form.sublineId) : null,
      letter_link: form.letterLink.trim() || null,
    };
    const { error } = await supabase.from('projects').update(payload).eq('project_id', project.id);
    if (error) { setFormError(`Error al actualizar: ${error.message}`); setSaving(false); return; }

    // registrar historial
    const { data: histData } = await supabase.from('histories').insert({
      description: 'Proyecto actualizado',
      change_type: 'Actualización',
      modified_field: 'Varios',
    }).select('history_id').single();
    if (histData?.history_id) {
      await supabase.from('project_histories').insert({ project_id: project.id, history_id: histData.history_id });
    }

    setFormSuccess('Proyecto actualizado correctamente.');
    fetchHistory();
    setSaving(false);
    setTimeout(() => { setFormSuccess(''); onSaved?.(); }, 1800);
  };

  // ── agregar / actualizar participante ────────────────────
  const handleAddParticipant = async () => {
    const name = newParticipantName.trim();
    if (!name) return;
    setVerifyingParticipant(true);
    setParticipantError('');
    // Buscar por nombre completo (búsqueda insensible)
    const { data, error } = await supabase
      .from('users')
      .select('user_id, full_name, email, user_roles(role_id)')
      .ilike('full_name', `%${name}%`)
      .limit(1);
    
    if (error || !data || data.length === 0) {
      setParticipantError('Usuario no encontrado en el sistema.');
      setVerifyingParticipant(false);
      return;
    }
    const user = data[0];
    // Validar: solo docentes y directores pueden ser jurado (no estudiantes, role_id 3)
    if (newParticipantRole === 'jurado') {
      const roles = (user.user_roles || []).map(r => r.role_id);
      const soloEstudiante = roles.length === 0 || (roles.length > 0 && roles.every(r => r === 3));
      if (soloEstudiante) {
        setParticipantError('Solo docentes o directores pueden ser asignados como jurado.');
        setVerifyingParticipant(false);
        return;
      }
    }
    // Validar conflicto: si el rol a asignar es 'jurado' y el usuario ya es asesor, no permitir
    if (newParticipantRole === 'jurado' && user.user_id === selectedAdvisorId) {
      setParticipantError('Este docente ya es asesor del proyecto y no puede ser jurado.');
      setVerifyingParticipant(false);
      return;
    }
    const exists = participants.find(p => p.userId === user.user_id);
    if (exists) {
      // Validar conflicto al actualizar rol
      if (newParticipantRole === 'jurado' && exists.role === 'asesor') {
        setParticipantError('Este docente ya es asesor del proyecto y no puede ser jurado.');
        setVerifyingParticipant(false);
        return;
      }
      // actualizar rol
      await supabase.from('user_projects').update({ project_role: newParticipantRole }).eq('project_id', project.id).eq('user_id', user.user_id);
    } else {
      await supabase.from('user_projects').insert({ project_id: project.id, user_id: user.user_id, project_role: newParticipantRole });
    }
    setNewParticipantName('');
    fetchParticipants();
    setVerifyingParticipant(false);
  };

  // ── eliminar participante ────────────────────────────────
  const handleRemoveParticipant = async (userId) => {
    await supabase.from('user_projects').delete().eq('project_id', project.id).eq('user_id', userId);
    fetchParticipants();
  };

  // ── actualizar rol en línea ──────────────────────────────
  const handleUpdateRole = async (userId, newRole) => {
    await supabase.from('user_projects').update({ project_role: newRole }).eq('project_id', project.id).eq('user_id', userId);
    setEditingParticipant(null);
    fetchParticipants();
  };

  // ── agregar asesor por nombre ───────────────────────────
  const handleAddAdvisor = async () => {
    const name = advisorName.trim();
    if (!name) return;
    setAddingAdvisor(true);
    setAdvisorError('');
    const { data, error } = await supabase
      .from('users')
      .select('user_id, full_name, email, user_roles(role_id)')
      .ilike('full_name', `%${name}%`)
      .limit(1);
    if (error || !data || data.length === 0) {
      setAdvisorError('Usuario no encontrado en el sistema.');
      setAddingAdvisor(false);
      return;
    }
    const found = data[0];
    // Validar: solo docentes o directores pueden ser asesores (no estudiantes, role_id 3)
    const rolesAsesor = (found.user_roles || []).map(r => r.role_id);
    const soloEstudianteAsesor = rolesAsesor.length === 0 || rolesAsesor.every(r => r === 3);
    if (soloEstudianteAsesor) {
      setAdvisorError('Solo docentes o directores pueden ser asignados como asesor.');
      setAddingAdvisor(false);
      return;
    }
    const esJurado = participants.some(p => p.userId === found.user_id && p.role === 'jurado');
    if (esJurado) {
      setAdvisorError('Este docente ya es jurado del proyecto y no puede ser asesor.');
      setAddingAdvisor(false);
      return;
    }
    // eliminar asesor anterior e insertar el nuevo
    await supabase.from('user_projects').delete().eq('project_id', project.id).eq('project_role', 'asesor');
    await supabase.from('user_projects').insert({ project_id: project.id, user_id: found.user_id, project_role: 'asesor' });
    setSelectedAdvisorId(found.user_id);
    setAdvisorName('');
    fetchParticipants();
    setAddingAdvisor(false);
  };

  // ── quitar asesor ────────────────────────────────────────
  const handleRemoveAdvisor = async () => {
    await supabase.from('user_projects').delete().eq('project_id', project.id).eq('project_role', 'asesor');
    setSelectedAdvisorId('');
    setAdvisorName('');
    fetchParticipants();
  };

  // ── guardar acta ─────────────────────────────────────────
  const handleSaveActa = async () => {
    if (!actaLink.trim()) return;
    setSavingActa(true);
    await supabase.from('projects').update({ letter_link: actaLink.trim() }).eq('project_id', project.id);
    const { data: histData } = await supabase.from('histories').insert({
      description: 'Acta registrada',
      change_type: 'Acta',
      modified_field: 'letter_link',
      new_value: actaLink.trim(),
      changed_at: actaDate || new Date().toISOString(),
    }).select('history_id').single();
    if (histData?.history_id) {
      await supabase.from('project_histories').insert({ project_id: project.id, history_id: histData.history_id });
    }
    setActaLink('');
    setActaDate('');
    fetchHistory();
    setSavingActa(false);
  };

  const integrantes = participants.filter(p => p.role === 'autor' || p.role === 'coautor');
  const jurados = participants.filter(p => p.role === 'jurado');
  const currentAdvisor = participants.find(p => p.role === 'asesor');

  const ROLE_LABELS = { autor: 'Autor', coautor: 'Co-autor', asesor: 'Asesor', jurado: 'Jurado' };
  const ROLE_OPTIONS = ['autor', 'coautor', 'jurado'];

  return (
    <>
      <div className="epm-backdrop" onClick={onClose}>
        <div className="epm-modal" onClick={e => e.stopPropagation()}>

          {/* ── HEADER ── */}
          <div className="epm-header">
            <div>
              <span className="epm-eyebrow">Editar proyecto</span>
              <h2 className="epm-title">{project.title}</h2>
              <span className="epm-code">{project.code}</span>
            </div>
            <button className="epm-close-btn" type="button" onClick={onClose}><X size={16} /></button>
          </div>

          {/* ── BODY ── */}
          <div className="epm-body">

            {/* ── LEFT PANEL ── */}
            <div className="epm-left">

              {/* alert */}
              {(formError || formSuccess) && (
                <div className={`epm-alert ${formError ? 'epm-alert--error' : 'epm-alert--success'}`}>
                  {formError || formSuccess}
                </div>
              )}

              <form onSubmit={handleSave}>
                <div className="epm-section-title">Información general</div>

                <div className="epm-grid2">
                  <div className="epm-field">
                    <label>Título *</label>
                    <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
                  </div>
                  <div className="epm-field">
                    <label>Código</label>
                    <input value={form.code} readOnly style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed', color: 'var(--text-muted)' }} />
                  </div>
                  <div className="epm-field">
                    <label>Fecha de creación</label>
                    <input value={project.year || ''} readOnly style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed', color: 'var(--text-muted)' }} />
                  </div>
                  <div className="epm-field">
                    <label>Fecha fin</label>
                    <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} placeholder="no registra" />
                  </div>
                  <div className="epm-field">
                    <label>Carta / link</label>
                    <input type="url" value={form.letterLink} onChange={e => setForm(p => ({ ...p, letterLink: e.target.value }))} placeholder="https://drive.google.com/..." />
                  </div>
                  <div className="epm-field">
                    <label>Línea de investigación</label>
                    <div className="epm-select-wrap">
                      <select value={form.lineId} onChange={e => setForm(p => ({ ...p, lineId: e.target.value, sublineId: '' }))}>
                        <option value="">— Selecciona —</option>
                        {lines.map(l => <option key={l.research_line_id} value={l.research_line_id}>{l.name}</option>)}
                      </select>
                      <ChevronDown size={13} className="epm-chevron" />
                    </div>
                  </div>
                  <div className="epm-field">
                    <label>Estado *</label>
                    <div className="epm-select-wrap">
                      <select value={form.statusId} onChange={e => setForm(p => ({ ...p, statusId: e.target.value }))} required>
                        <option value="">— Selecciona —</option>
                        {statuses.map(s => <option key={s.status_id} value={s.status_id}>{s.name}</option>)}
                      </select>
                      <ChevronDown size={13} className="epm-chevron" />
                    </div>
                  </div>
                  <div className="epm-field">
                    <label>Modalidad *</label>
                    <div className="epm-select-wrap">
                      <select value={form.modalityId} onChange={e => setForm(p => ({ ...p, modalityId: e.target.value }))} required>
                        <option value="">— Selecciona —</option>
                        {modalities.map(m => <option key={m.modality_id} value={m.modality_id}>{m.name}</option>)}
                      </select>
                      <ChevronDown size={13} className="epm-chevron" />
                    </div>
                  </div>
                  <div className="epm-field">
                    <label>Sublínea</label>
                    <div className="epm-select-wrap">
                      <select value={form.sublineId} onChange={e => setForm(p => ({ ...p, sublineId: e.target.value }))} disabled={!form.lineId}>
                        <option value="">— Selecciona —</option>
                        {filteredSublines.map(s => <option key={s.research_subline_id} value={s.research_subline_id}>{s.name}</option>)}
                      </select>
                      <ChevronDown size={13} className="epm-chevron" />
                    </div>
                  </div>
                  <div className="epm-field">
                    <label>Período</label>
                    <input value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} placeholder="Ej: 2023-01" />
                  </div>
                  <div className="epm-field epm-span2">
                    <label>Objetivos</label>
                    <textarea rows={3} value={form.objectives} onChange={e => setForm(p => ({ ...p, objectives: e.target.value }))} placeholder="Describe los objetivos del proyecto..." />
                  </div>
                </div>

                <div className="epm-form-actions">
                  <button type="button" className="epm-btn-ghost" onClick={onClose}>Cancelar</button>
                  <button type="submit" className="epm-btn-primary" disabled={saving}>
                    {saving ? <><Loader2 size={14} className="epm-spin" /> Guardando...</> : <><Save size={14} /> Guardar cambios</>}
                  </button>
                </div>
              </form>

              {/* ── HISTORIAL (tabla inferior izquierda) ── */}
              <div className="epm-section-title" style={{ marginTop: 28 }}>Historial de cambios</div>
              <div className="epm-history-table-wrap">
                {loadingHistory ? (
                  <div className="epm-loading">Cargando historial...</div>
                ) : history.length === 0 ? (
                  <div className="epm-empty">Sin registros de cambios.</div>
                ) : (
                  <table className="epm-history-table">
                    <thead>
                      <tr>
                        <th>Asesor actual</th>
                        <th>Asesor anterior</th>
                        <th>Objetivos anteriores</th>
                        <th>Objetivos actuales</th>
                        <th>Fecha cambio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(h => (
                        <tr key={h.id}>
                          <td>{h.newVal || currentAdvisor?.name || '—'}</td>
                          <td>{h.oldVal || '—'}</td>
                          <td>{h.field === 'Objetivos' ? h.oldVal : '—'}</td>
                          <td>{h.field === 'Objetivos' ? h.newVal : h.detail}</td>
                          <td>{h.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="epm-right">

              {/* ── INTEGRANTES ── */}
              <div className="epm-panel-card">
                <div className="epm-panel-header">
                  <span className="epm-panel-label">Integrantes</span>
                </div>
                {loadingParticipants ? (
                  <div className="epm-loading">Cargando...</div>
                ) : (
                  <>
                    {integrantes.map(p => (
                      <div key={p.userId} className="epm-person-row">
                        <Avatar name={p.name} size={30} />
                        <div className="epm-person-info">
                          {editingParticipant?.userId === p.userId ? (
                            <div className="epm-select-wrap" style={{ flex: 1 }}>
                              <select
                                defaultValue={p.role}
                                onChange={e => handleUpdateRole(p.userId, e.target.value)}
                                onBlur={() => setEditingParticipant(null)}
                                autoFocus
                              >
                                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                              </select>
                              <ChevronDown size={12} className="epm-chevron" />
                            </div>
                          ) : (
                            <>
                              <span className="epm-person-name">{p.name}</span>
                              <span className="epm-person-role">{ROLE_LABELS[p.role] || p.role}</span>
                            </>
                          )}
                        </div>
                        <div className="epm-person-actions">
                          <button className="epm-icon-btn" title="Editar rol" onClick={() => setEditingParticipant({ userId: p.userId, role: p.role })}>
                            <Pencil size={13} />
                          </button>
                          <button className="epm-icon-btn epm-icon-btn--danger" title="Eliminar" onClick={() => handleRemoveParticipant(p.userId)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="epm-add-row">
                      <Plus size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      <input
                        className="epm-inline-input"
                        placeholder="Nombre completo"
                        value={newParticipantName}
                        onChange={e => { setNewParticipantName(e.target.value); setNewParticipantRole('coautor'); setParticipantError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddParticipant(); } }}
                      />
                      <div className="epm-select-wrap" style={{ minWidth: 90 }}>
                        <select value={newParticipantRole === 'jurado' ? 'coautor' : newParticipantRole} onChange={e => setNewParticipantRole(e.target.value)}>
                          <option value="coautor">Co-autor</option>
                          <option value="autor">Autor</option>
                        </select>
                        <ChevronDown size={11} className="epm-chevron" />
                      </div>
                      <button className="epm-add-btn" onClick={() => { setNewParticipantRole(newParticipantRole === 'jurado' ? 'coautor' : newParticipantRole); handleAddParticipant(); }} disabled={verifyingParticipant}>
                        {verifyingParticipant ? <Loader2 size={12} className="epm-spin" /> : 'Agregar'}
                      </button>
                    </div>
                    {participantError && <p className="epm-inline-error">{participantError}</p>}
                  </>
                )}
              </div>

              {/* ── JURADOS ── */}
              <div className="epm-panel-card">
                <div className="epm-panel-header">
                  <span className="epm-panel-label">Jurados</span>
                </div>
                {jurados.map(p => (
                  <div key={p.userId} className="epm-person-row">
                    <Avatar name={p.name} size={30} />
                    <div className="epm-person-info">
                      <span className="epm-person-name">{p.name}</span>
                      <span className="epm-person-role">Jurado</span>
                    </div>
                    <div className="epm-person-actions">
                      <button className="epm-icon-btn epm-icon-btn--danger" title="Eliminar jurado" onClick={() => handleRemoveParticipant(p.userId)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="epm-add-row">
                  <Plus size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <input
                    className="epm-inline-input"
                    placeholder="Nombre del jurado"
                    value={newParticipantRole === 'jurado' ? newParticipantName : ''}
                    onChange={e => { setNewParticipantName(e.target.value); setNewParticipantRole('jurado'); setParticipantError(''); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setNewParticipantRole('jurado');
                        handleAddParticipant();
                      }
                    }}
                  />
                  <button className="epm-add-btn" onClick={() => { setNewParticipantRole('jurado'); handleAddParticipant(); }} disabled={verifyingParticipant}>
                    {verifyingParticipant ? <Loader2 size={12} className="epm-spin" /> : 'Agregar'}
                  </button>
                </div>
              </div>

              {/* ── ASESOR ── */}
              <div className="epm-panel-card">
                <div className="epm-panel-header">
                  <span className="epm-panel-label">Asesor</span>
                </div>
                {currentAdvisor && (
                  <div className="epm-person-row">
                    <Avatar name={currentAdvisor.name} size={30} />
                    <div className="epm-person-info">
                      <span className="epm-person-name">{currentAdvisor.name}</span>
                      <span className="epm-person-role">Asesor</span>
                    </div>
                    <div className="epm-person-actions">
                      <button className="epm-icon-btn epm-icon-btn--danger" title="Quitar asesor" onClick={handleRemoveAdvisor}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
                <div className="epm-add-row">
                  <Plus size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <input
                    className="epm-inline-input"
                    placeholder="Nombre del asesor"
                    value={advisorName}
                    onChange={e => { setAdvisorName(e.target.value); setAdvisorError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAdvisor(); } }}
                  />
                  <button className="epm-add-btn" onClick={handleAddAdvisor} disabled={addingAdvisor}>
                    {addingAdvisor ? <Loader2 size={12} className="epm-spin" /> : 'Asignar'}
                  </button>
                </div>
                {advisorError && <p className="epm-inline-error">{advisorError}</p>}
              </div>

              {/* ── AGREGAR ACTA ── */}
              <div className="epm-panel-card">
                <div className="epm-panel-header">
                  <span className="epm-panel-label">Agregar acta</span>
                </div>
                <div className="epm-field" style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Enlace del acta</label>
                  <input
                    type="url"
                    className="epm-inline-input epm-full"
                    placeholder="https://drive.google.com/..."
                    value={actaLink}
                    onChange={e => setActaLink(e.target.value)}
                  />
                </div>
                <div className="epm-field">
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Fecha</label>
                  <input
                    type="date"
                    className="epm-inline-input epm-full"
                    value={actaDate}
                    onChange={e => setActaDate(e.target.value)}
                  />
                </div>
                <button className="epm-btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={handleSaveActa} disabled={savingActa || !actaLink.trim()}>
                  {savingActa ? <><Loader2 size={13} className="epm-spin" /> Guardando...</> : 'Guardar acta'}
                </button>
              </div>

            </div>{/* end right */}
          </div>{/* end body */}
        </div>
      </div>

      <style>{`
        .epm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.52);
          backdrop-filter: blur(3px);
          z-index: 300;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 20px;
          overflow-y: auto;
          animation: epmFadeIn 0.18s ease;
        }
        @keyframes epmFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .epm-modal {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-xl);
          box-shadow: 0 24px 64px rgba(0,0,0,0.2);
          width: 100%;
          max-width: 1100px;
          display: flex;
          flex-direction: column;
          animation: epmSlideUp 0.22s ease;
          overflow: hidden;
          margin: auto;
        }
        @keyframes epmSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .epm-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
          background: linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 7%, transparent), transparent 60%), var(--bg-card);
        }

        .epm-eyebrow {
          display: block;
          font-size: 0.67rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--accent-primary);
          margin-bottom: 4px;
        }
        .epm-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin: 0 0 3px;
          line-height: 1.3;
        }
        .epm-code {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-family: monospace;
        }
        .epm-close-btn {
          background: none;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-muted);
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .epm-close-btn:hover { background: var(--bg-primary); color: var(--text-primary); }

        /* ── BODY ── */
        .epm-body {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 0;
          min-height: 0;
          overflow: hidden;
        }

        .epm-left {
          padding: 20px 24px;
          overflow-y: auto;
          border-right: 1px solid var(--border-color);
        }

        .epm-right {
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: var(--bg-primary);
        }

        /* ── SECTION TITLE ── */
        .epm-section-title {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: var(--text-muted);
          margin-bottom: 14px;
        }

        /* ── FORM ── */
        .epm-grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .epm-span2 { grid-column: span 2; }

        .epm-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .epm-field label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .epm-field input,
        .epm-field textarea,
        .epm-field select {
          padding: 8px 11px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          background: var(--bg-secondary);
          font-size: 0.84rem;
          font-family: var(--font-body);
          color: var(--text-primary);
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          width: 100%;
          box-sizing: border-box;
        }
        .epm-field input:focus,
        .epm-field textarea:focus,
        .epm-field select:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 14%, transparent);
        }
        .epm-field textarea { resize: vertical; }

        .epm-select-wrap { position: relative; }
        .epm-select-wrap select {
          appearance: none;
          padding-right: 28px;
          cursor: pointer;
        }
        .epm-chevron {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .epm-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 18px;
        }

        /* ── BUTTONS ── */
        .epm-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          background: var(--accent-primary);
          color: #fff;
          border: none;
          border-radius: var(--border-radius-sm);
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .epm-btn-primary:hover:not(:disabled) { opacity: 0.87; }
        .epm-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .epm-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .epm-btn-ghost:hover { background: var(--bg-primary); color: var(--text-primary); }

        .epm-add-btn {
          padding: 6px 12px;
          background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
          color: var(--accent-primary);
          border: 1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent);
          border-radius: var(--border-radius-sm);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: opacity 0.15s;
        }
        .epm-add-btn:hover:not(:disabled) { opacity: 0.8; }
        .epm-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── ALERTS ── */
        .epm-alert {
          padding: 9px 12px;
          border-radius: var(--border-radius-sm);
          font-size: 0.82rem;
          margin-bottom: 14px;
          border: 1px solid;
        }
        .epm-alert--error {
          border-color: color-mix(in srgb, var(--accent-danger) 35%, var(--border-color));
          background: color-mix(in srgb, var(--accent-danger) 10%, transparent);
          color: var(--accent-danger);
        }
        .epm-alert--success {
          border-color: color-mix(in srgb, var(--accent-success) 35%, var(--border-color));
          background: color-mix(in srgb, var(--accent-success) 10%, transparent);
          color: var(--accent-success);
        }

        /* ── RIGHT PANEL CARDS ── */
        .epm-panel-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          padding: 12px 14px;
        }
        .epm-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .epm-panel-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }

        /* ── PERSON ROW ── */
        .epm-person-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          border-bottom: 1px solid var(--border-color);
        }
        .epm-person-row:last-of-type { border-bottom: none; }
        .epm-person-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .epm-person-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .epm-person-role {
          font-size: 0.7rem;
          color: var(--text-muted);
        }
        .epm-person-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }
        .epm-icon-btn {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .epm-icon-btn:hover { color: var(--text-primary); border-color: var(--accent-primary); }
        .epm-icon-btn--danger { color: var(--accent-danger); }
        .epm-icon-btn--danger:hover { background: color-mix(in srgb, var(--accent-danger) 10%, transparent); border-color: var(--accent-danger); }

        /* ── ADD ROW ── */
        .epm-add-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding-top: 8px;
        }
        .epm-inline-input {
          flex: 1;
          padding: 5px 8px;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          background: var(--bg-secondary);
          font-size: 0.78rem;
          color: var(--text-primary);
          outline: none;
          min-width: 0;
        }
        .epm-inline-input:focus { border-color: var(--accent-primary); }
        .epm-full { width: 100%; box-sizing: border-box; }
        .epm-inline-error { font-size: 0.72rem; color: var(--accent-danger); margin-top: 4px; }

        /* ── ASESOR ── */
        .epm-asesor-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .epm-asesor-row .epm-select-wrap select {
          padding: 7px 28px 7px 10px;
          font-size: 0.82rem;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          background: var(--bg-secondary);
          color: var(--text-primary);
          width: 100%;
          outline: none;
        }
        .epm-asesor-row .epm-select-wrap select:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 14%, transparent);
        }

        /* ── HISTORIAL TABLE ── */
        .epm-history-table-wrap {
          overflow-x: auto;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
        }
        .epm-history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }
        .epm-history-table th {
          padding: 9px 14px;
          text-align: left;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-muted);
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
          white-space: nowrap;
        }
        .epm-history-table td {
          padding: 10px 14px;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border-color);
          vertical-align: top;
        }
        .epm-history-table tr:last-child td { border-bottom: none; }
        .epm-history-table tr:hover td { background: color-mix(in srgb, var(--accent-primary) 4%, transparent); }

        /* ── MISC ── */
        .epm-loading { font-size: 0.8rem; color: var(--text-muted); padding: 8px 0; }
        .epm-empty { font-size: 0.8rem; color: var(--text-muted); padding: 8px 0; text-align: center; }

        @keyframes epmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .epm-spin { animation: epmSpin 0.9s linear infinite; }

        /* ── RESPONSIVE ── */
        @media (max-width: 820px) {
          .epm-body { grid-template-columns: 1fr; }
          .epm-left { border-right: none; border-bottom: 1px solid var(--border-color); }
          .epm-right { flex-direction: row; flex-wrap: wrap; }
          .epm-panel-card { flex: 1 1 240px; }
        }
        @media (max-width: 540px) {
          .epm-grid2 { grid-template-columns: 1fr; }
          .epm-span2 { grid-column: span 1; }
          .epm-modal { border-radius: var(--border-radius-lg); }
        }
      `}</style>
    </>
  );
}