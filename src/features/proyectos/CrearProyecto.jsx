import { useEffect, useMemo, useState } from 'react';
import { X, ChevronDown, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import './CrearProyecto.css';

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

export default function CreateProjectModal({ statuses, modalities, lines, sublines, onClose, onSaved, user }) {
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

  const [pendingParticipants, setPendingParticipants] = useState([]);
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantRole, setNewParticipantRole] = useState('coautor');
  const [verifyingParticipant, setVerifyingParticipant] = useState(false);
  const [participantError, setParticipantError] = useState('');

  const userProgramId = user?.programId ?? user?.program_id ?? null;
  const userProgramName = String(user?.programName ?? user?.program_name ?? '').toLowerCase();
  const isPsicologia = String(userProgramId) === '2' || userProgramName.includes('psicolog');
  const isSistemas = String(userProgramId) === '1' || userProgramName.includes('sistema');

  const filteredLines = useMemo(() => {
    const allLines = lines || [];
    if (!allLines.length) return [];

    return allLines.filter(line => {
      // 1. Si la línea trae program_id explícito
      if (line.program_id !== undefined && line.program_id !== null) {
        return String(line.program_id) === String(userProgramId);
      }
      // 2. Si no trae program_id (fallback por ID o nombre del programa)
      const name = (line.name || '').toLowerCase();
      if (isPsicologia) {
        return [4, 5, 6].includes(line.research_line_id) || name.includes('psicolog');
      }
      if (isSistemas) {
        return [1, 2, 3].includes(line.research_line_id) || (!name.includes('psicolog') && !name.includes('salud') && !name.includes('comunitaria'));
      }
      return true;
    });
  }, [lines, userProgramId, isPsicologia, isSistemas]);

  const filteredSublines = useMemo(() => {
    if (!form.lineId) return [];

    // Las sublíneas dependen directamente de la línea seleccionada.
    return (sublines || []).filter(
      subline =>
        String(subline.research_line_id) === String(form.lineId)
    );
  }, [sublines, form.lineId]);

  useEffect(() => {
    if (!form.lineId) return;
    const generateCode = async () => {
      setIsGeneratingCode(true);
      const line = filteredLines.find(l => String(l.research_line_id) === String(form.lineId));
      const prefix = generatePrefix(line?.name);
      try {
        const existingProjects = await api.getProjects(userProgramId);
        const nums = (existingProjects || [])
          .map(p => parseInt((p.code || '').split('-')[1] || '0', 10))
          .filter(n => !isNaN(n));
        const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
        setForm(prev => ({ ...prev, code: `${prefix}-${maxNum + 1}` }));
      } catch (_) {
        setForm(prev => ({ ...prev, code: `${prefix}-1` }));
      } finally {
        setIsGeneratingCode(false);
      }
    };
    generateCode();
  }, [form.lineId, filteredLines, userProgramId]);

  const handleLineChange = (e) => {
    setForm(prev => ({ ...prev, lineId: e.target.value, sublineId: '' }));
  };

  const handleAddParticipant = async () => {
    const email = newParticipantEmail.trim();
    if (!email) return;
    setVerifyingParticipant(true);
    setParticipantError('');
    try {
      const res = await api.checkCoauthor(email);
      const found = res.user;
      if (!found) {
        setParticipantError('Usuario no encontrado en el sistema.');
        return;
      }
      const exists = pendingParticipants.find(p => p.id === found.user_id);
      if (exists) {
        setParticipantError('Este usuario ya fue agregado.');
        return;
      }

      setPendingParticipants(prev => [...prev, {
        id: found.user_id,
        name: found.full_name,
        email: found.email,
        role: newParticipantRole,
      }]);
      setNewParticipantEmail('');
      setNewParticipantRole('coautor');
    } catch (err) {
      setParticipantError(err.message || 'Usuario no encontrado.');
    } finally {
      setVerifyingParticipant(false);
    }
  };

  const handleRemoveParticipant = (id) => {
    setPendingParticipants(prev => prev.filter(p => p.id !== id));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('El título es obligatorio.'); return; }
    if (form.title.trim().length > 255) { setFormError('El título es demasiado largo (máximo 255 caracteres).'); return; }
    if (!form.modalityId) { setFormError('Selecciona una modalidad.'); return; }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        title: form.title.trim(),
        code: form.code.trim() || null,
        statusId: statuses?.[0]?.status_id || 1,
        modalityId: Number(form.modalityId) || null,
        lineId: form.lineId ? Number(form.lineId) : null,
        sublineId: form.sublineId ? Number(form.sublineId) : null,
        letterLink: form.letterLink.trim() || null,
        creatorUserId: user?.id,
        coauthors: pendingParticipants,
      };

      await api.createProject(payload);
      setFormSuccess('¡Proyecto creado correctamente!');
      setTimeout(() => { onSaved?.(); }, 1200);
    } catch (err) {
      setFormError(`No fue posible crear el proyecto: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const integrantes = pendingParticipants.filter(p => p.role === 'autor' || p.role === 'coautor');
  const ROLE_LABELS = { autor: 'Autor', coautor: 'Co-autor' };

  return (
    <>
      <div className="epm-backdrop" onClick={onClose}>
        <div className="epm-modal" onClick={e => e.stopPropagation()}>
          {/* HEADER */}
          <div className="epm-header">
            <div>
              <span className="epm-eyebrow">Nuevo proyecto</span>
              <h2 className="epm-title">Registrar proyecto de grado</h2>
              <span className="epm-code">Completa los campos para crear el proyecto</span>
            </div>
            <button className="epm-close-btn" type="button" onClick={onClose}><X size={16} /></button>
          </div>

          {/* BODY */}
          <div className="epm-body">
            {/* LEFT PANEL */}
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
                        {filteredLines.map(l => <option key={l.research_line_id} value={l.research_line_id}>{l.name}</option>)}
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
                  <div className="epm-field epm-span2">
                    <label>Carta / link</label>
                    <input
                      type="url"
                      value={form.letterLink}
                      onChange={e => setForm(p => ({ ...p, letterLink: e.target.value }))}
                      placeholder="https://drive.google.com/..."
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

            {/* RIGHT PANEL */}
            <div className="epm-right">
              <div className="epm-panel-card">
                <div className="epm-panel-header">
                  <span className="epm-panel-label">Coautores / Integrantes</span>
                </div>
                {integrantes.length === 0 && (
                  <div className="epm-empty">Sin integrantes agregados aún.</div>
                )}
                {integrantes.map(p => (
                  <div key={p.id} className="epm-person-row">
                    <Avatar name={p.name} size={30} />
                    <div className="epm-person-info">
                      <span className="epm-person-name">{p.name}</span>
                      <span className="epm-person-role">{ROLE_LABELS[p.role] || p.role}</span>
                    </div>
                    <div className="epm-person-actions">
                      <button className="epm-icon-btn epm-icon-btn--danger" title="Eliminar" onClick={() => handleRemoveParticipant(p.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="epm-add-row">
                  <Plus size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <input
                    className="epm-inline-input"
                    placeholder="Correo de coautor"
                    value={newParticipantEmail}
                    onChange={e => { setNewParticipantEmail(e.target.value); setParticipantError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddParticipant(); } }}
                  />
                  <button className="epm-add-btn" onClick={handleAddParticipant} disabled={verifyingParticipant}>
                    {verifyingParticipant ? <Loader2 size={12} className="epm-spin" /> : 'Agregar'}
                  </button>
                </div>
                {participantError && <p className="epm-inline-error">{participantError}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}