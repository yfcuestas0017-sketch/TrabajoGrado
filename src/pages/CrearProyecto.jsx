import { useEffect, useState, useCallback } from 'react';
import { X, ChevronDown, Plus, Trash2, Save, Loader2 } from 'lucide-react';
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
export default function CreateProjectModal({ statuses, modalities, lines, sublines, onClose, onSaved, user }) {
  // ── form básico ─────────────────────────────────────────
  const [form, setForm] = useState({
    title: '',
    code: '',
    statusId: '',
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

  // ── asesor ───────────────────────────────────────────────
  const [allAdvisors, setAllAdvisors] = useState([]);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState('');

  const supabase = getSupabaseClient();

  // ── sublines filtradas ───────────────────────────────────
  const filteredSublines = form.lineId
    ? sublines.filter(s => String(s.research_line_id) === String(form.lineId))
    : sublines;

  // ── cargar asesores disponibles ──────────────────────────
  const fetchAdvisors = useCallback(async () => {
    const { data: docentes } = await supabase
      .from('users')
      .select('user_id, full_name, email')
      .eq('role_id', 4);
    setAllAdvisors(docentes || []);
  }, []);

  useEffect(() => {
    fetchAdvisors();
  }, [fetchAdvisors]);

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
  const handleAddParticipant = async () => {
    const name = newParticipantName.trim();
    if (!name) return;
    setVerifyingParticipant(true);
    setParticipantError('');
    const { data, error } = await supabase
      .from('users')
      .select('user_id, full_name, email')
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

    // Asignar asesor si fue seleccionado
    if (selectedAdvisorId) {
      await supabase.from('user_projects').insert({
        project_id: newProjectId,
        user_id: selectedAdvisorId,
        project_role: 'asesor',
      });
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
  const jurados = pendingParticipants.filter(p => p.role === 'jurado');
  const ROLE_LABELS = { autor: 'Autor', coautor: 'Co-autor', jurado: 'Jurado' };

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
              </div>

              {/* ── JURADOS ── */}
              <div className="epm-panel-card">
                <div className="epm-panel-header">
                  <span className="epm-panel-label">Jurados</span>
                </div>
                {jurados.length === 0 && (
                  <div className="epm-empty">Sin jurados agregados aún.</div>
                )}
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
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setNewParticipantRole('jurado'); handleAddParticipant(); } }}
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
                <div className="epm-asesor-row">
                  <div className="epm-select-wrap" style={{ flex: 1 }}>
                    <select value={selectedAdvisorId} onChange={e => setSelectedAdvisorId(e.target.value)}>
                      <option value="">Sin asesor asignado</option>
                      {allAdvisors.map(a => <option key={a.user_id} value={a.user_id}>{a.full_name}</option>)}
                    </select>
                    <ChevronDown size={13} className="epm-chevron" />
                  </div>
                </div>
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

        .epm-section-title {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: var(--text-muted);
          margin-bottom: 14px;
        }

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
        .epm-inline-error { font-size: 0.72rem; color: var(--accent-danger); margin-top: 4px; }

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

        .epm-loading { font-size: 0.8rem; color: var(--text-muted); padding: 8px 0; }
        .epm-empty { font-size: 0.8rem; color: var(--text-muted); padding: 8px 0; text-align: center; }

        @keyframes epmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .epm-spin { animation: epmSpin 0.9s linear infinite; }

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