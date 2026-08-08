import { useEffect, useState, useCallback } from 'react';
import { X, ChevronDown, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase/client';
import './CrearProyecto.css';

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
export default function CreateProjectModal({ statuses, modalities, lines, sublines, onClose, onSaved, user }) {
  // ── form básico ─────────────────────────────────────────
  const [form, setForm] = useState({
    title: '',
    code: '',
    modalityId: '',
    lineId: '',
    sublineId: '',
    letterLink: '',
    period: '',
    objectives: '',
    endDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  // ── integrantes (para agregar antes de crear) ────────────
  const [pendingParticipants, setPendingParticipants] = useState([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantRole, setNewParticipantRole] = useState('coautor');
  const [verifyingParticipant, setVerifyingParticipant] = useState(false);
  const [participantError, setParticipantError] = useState('');



  const supabase = getSupabaseClient();

  // ── sublines filtradas ───────────────────────────────────
  const filteredSublines = form.lineId
    ? sublines.filter(s => String(s.research_line_id) === String(form.lineId))
    : sublines;



  // ── generar código automático al seleccionar línea ───────
  useEffect(() => {
    if (!form.lineId) return;
    const generateCode = async () => {
      setIsGeneratingCode(true);
      const line = lines.find(l => String(l.research_line_id) === String(form.lineId));
      const prefix = generatePrefix(line?.name);
      const { data } = await supabase
        .from('projects')
        .select('code')
        .ilike('code', `${prefix}-%`);
      const nums = (data || [])
        .map(p => parseInt((p.code || '').split('-')[1] || '0', 10))
        .filter(n => !isNaN(n));
      const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
      setForm(prev => ({ ...prev, code: `${prefix}-${maxNum + 1}` }));
      setIsGeneratingCode(false);
    };
    generateCode();
  }, [form.lineId, lines]);

  // ── limpiar sublínea si cambia la línea ──────────────────
  const handleLineChange = (e) => {
    setForm(prev => ({ ...prev, lineId: e.target.value, sublineId: '' }));
  };

  // ── buscar participante por nombre ───────────────────────
  // ── asesor por nombre ────────────────────────────────────
  const handleAddAdvisor = async () => {
    const name = advisorName.trim();
    if (!name) return;
    setAddingAdvisor(true);
    setAdvisorError('');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('user_id, full_name, user_roles(role_id)')
      .ilike('full_name', `%${name}%`)
      .limit(1);
    if (error || !data || data.length === 0) {
      setAdvisorError('Usuario no encontrado en el sistema.');
      setAddingAdvisor(false);
      return;
    }
    const found = data[0];
    const roles = (found.user_roles || []).map(r => r.role_id);
    if (roles.length === 0 || roles.every(r => r === 3)) {
      setAdvisorError('Solo docentes o directores pueden ser asignados como asesor.');
      setAddingAdvisor(false);
      return;
    }
    const esJurado = pendingParticipants.some(p => p.userId === found.user_id && p.role === 'jurado');
    if (esJurado) {
      setAdvisorError('Este docente ya es jurado del proyecto y no puede ser asesor.');
      setAddingAdvisor(false);
      return;
    }
    setSelectedAdvisorId(found.user_id);
    setSelectedAdvisorName(found.full_name);
    setAdvisorName('');
    setAddingAdvisor(false);
  };

  const handleAddParticipant = async () => {
    const name = newParticipantName.trim();
    if (!name) return;
    setVerifyingParticipant(true);
    setParticipantError('');
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
    const found = data[0];
    const exists = pendingParticipants.find(p => p.userId === found.user_id);
    if (exists) {
      setParticipantError('Este usuario ya fue agregado.');
      setVerifyingParticipant(false);
      return;
    }

    setPendingParticipants(prev => [...prev, {
      userId: found.user_id,
      name: found.full_name,
      email: found.email,
      role: newParticipantRole,
    }]);
    setNewParticipantName('');
    setNewParticipantRole('coautor');
    setVerifyingParticipant(false);
  };

  const handleRemoveParticipant = (userId) => {
    setPendingParticipants(prev => prev.filter(p => p.userId !== userId));
  };

  // ── guardar nuevo proyecto ───────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('El título es obligatorio.'); return; }
    if (form.title.trim().length > 255) { setFormError('El título es demasiado largo (máximo 255 caracteres).'); return; }
    if (!form.modalityId) { setFormError('Selecciona una modalidad.'); return; }

    setSaving(true);
    setFormError('');

    const payload = {
      title: form.title.trim(),
      code: form.code.trim() || null,
      modality_id: Number(form.modalityId) || null,
      research_line_id: form.lineId ? Number(form.lineId) : null,
      research_subline_id: form.sublineId ? Number(form.sublineId) : null,
      letter_link: form.letterLink.trim() || null,
    };

    const { data, error: insertError } = await supabase
      .from('projects')
      .insert(payload)
      .select('project_id')
      .single();

    if (insertError) {
      setFormError(`No fue posible crear el proyecto: ${insertError.message}`);
      setSaving(false);
      return;
    }

    const newProjectId = data.project_id;

    // Agregar al creador como autor
    if (user?.id) {
      await supabase.from('user_projects').insert({
        project_id: newProjectId,
        user_id: user.id,
        project_role: 'autor',
      });
    }

    // Agregar participantes pendientes
    if (pendingParticipants.length > 0) {
      await Promise.all(
        pendingParticipants.map(p =>
          supabase.from('user_projects').insert({
            project_id: newProjectId,
            user_id: p.userId,
            project_role: p.role,
          })
        )
      );
    }

    // Registrar en historial
    const { data: histData } = await supabase.from('histories').insert({
      description: 'Proyecto creado',
      change_type: 'Creación',
      modified_field: 'Nuevo proyecto',
    }).select('history_id').single();
    if (histData?.history_id) {
      await supabase.from('project_histories').insert({
        project_id: newProjectId,
        history_id: histData.history_id,
      });
    }

    setFormSuccess('¡Proyecto creado correctamente!');
    setSaving(false);
    setTimeout(() => { onSaved?.(); }, 1500);
  };

  const integrantes = pendingParticipants.filter(p => p.role === 'autor' || p.role === 'coautor');
  const ROLE_LABELS = { autor: 'Autor', coautor: 'Co-autor' };

  return (
    <>
      <div className="epm-backdrop" onClick={onClose}>
        <div className="epm-modal" onClick={e => e.stopPropagation()}>

          {/* ── HEADER ── */}
          <div className="epm-header">
            <div>
              <span className="epm-eyebrow">Nuevo proyecto</span>
              <h2 className="epm-title">Registrar proyecto de grado</h2>
              <span className="epm-code">Completa los campos para crear el proyecto</span>
            </div>
            <button className="epm-close-btn" type="button" onClick={onClose}><X size={16} /></button>
          </div>

          {/* ── BODY ── */}
          <div className="epm-body">

            {/* ── LEFT PANEL ── */}
            <div className="epm-left">

              {(formError || formSuccess) && (
                <div className={`epm-alert ${formError ? 'epm-alert--error' : 'epm-alert--success'}`}>
                  {formError || formSuccess}
                </div>
              )}

              <form onSubmit={handleSave}>
                <div className="epm-section-title">Información general</div>

                <div className="epm-grid2">
                  <div className="epm-field epm-span2">
                    <label>Título *</label>
                    <input
                      value={form.title}
                      onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Escribe el título del proyecto"
                      required
                    />
                  </div>
                  <div className="epm-field">
                    <label>Línea de investigación</label>
                    <div className="epm-select-wrap">
                      <select value={form.lineId} onChange={handleLineChange}>
                        <option value="">— Selecciona —</option>
                        {lines.map(l => <option key={l.research_line_id} value={l.research_line_id}>{l.name}</option>)}
                      </select>
                      <ChevronDown size={13} className="epm-chevron" />
                    </div>
                  </div>
                  <div className="epm-field">
                    <label>Código (auto-generado)</label>
                    <input
                      value={isGeneratingCode ? 'Generando...' : form.code}
                      onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                      placeholder="Se genera al elegir la línea"
                      style={isGeneratingCode ? { color: 'var(--text-muted)' } : {}}
                    />
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
                    <input
                      value={form.period}
                      onChange={e => setForm(p => ({ ...p, period: e.target.value }))}
                      placeholder="Ej: 2024-01"
                    />
                  </div>
                  <div className="epm-field">
                    <label>Fecha fin</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                    />
                  </div>
                  <div className="epm-field epm-span2">
                    <label>Carta / link</label>
                    <input
                      type="url"
                      value={form.letterLink}
                      onChange={e => setForm(p => ({ ...p, letterLink: e.target.value }))}
                      placeholder="https://drive.google.com/..."
                    />
                  </div>
                  <div className="epm-field epm-span2">
                    <label>Objetivos</label>
                    <textarea
                      rows={3}
                      value={form.objectives}
                      onChange={e => setForm(p => ({ ...p, objectives: e.target.value }))}
                      placeholder="Describe los objetivos del proyecto..."
                    />
                  </div>
                </div>

                <div className="epm-form-actions">
                  <button type="button" className="epm-btn-ghost" onClick={onClose}>Cancelar</button>
                  <button type="submit" className="epm-btn-primary" disabled={saving}>
                    {saving
                      ? <><Loader2 size={14} className="epm-spin" /> Creando...</>
                      : <><Save size={14} /> Crear proyecto</>
                    }
                  </button>
                </div>
              </form>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="epm-right">

              {/* ── INTEGRANTES ── */}
              <div className="epm-panel-card">
                <div className="epm-panel-header">
                  <span className="epm-panel-label">Integrantes</span>
                </div>
                {integrantes.length === 0 && (
                  <div className="epm-empty">Sin integrantes agregados aún.</div>
                )}
                {integrantes.map(p => (
                  <div key={p.userId} className="epm-person-row">
                    <Avatar name={p.name} size={30} />
                    <div className="epm-person-info">
                      <span className="epm-person-name">{p.name}</span>
                      <span className="epm-person-role">{ROLE_LABELS[p.role] || p.role}</span>
                    </div>
                    <div className="epm-person-actions">
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
                    value={newParticipantRole !== 'jurado' ? newParticipantName : ''}
                    onChange={e => { setNewParticipantName(e.target.value); setNewParticipantRole('coautor'); setParticipantError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddParticipant(); } }}
                  />
                  <div className="epm-select-wrap" style={{ minWidth: 90 }}>
                    <select value={newParticipantRole} onChange={e => setNewParticipantRole(e.target.value)}>
                      <option value="coautor">Co-autor</option>
                      <option value="autor">Autor</option>
                    </select>
                    <ChevronDown size={11} className="epm-chevron" />
                  </div>
                  <button className="epm-add-btn" onClick={handleAddParticipant} disabled={verifyingParticipant}>
                    {verifyingParticipant ? <Loader2 size={12} className="epm-spin" /> : 'Agregar'}
                  </button>
                </div>
                {participantError && <p className="epm-inline-error">{participantError}</p>}
              </div>

            </div>{/* end right */}
          </div>{/* end body */}
        </div>
      </div>

    </>
  );
}