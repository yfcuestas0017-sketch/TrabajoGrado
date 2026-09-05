import { useEffect, useState, useCallback, useMemo } from 'react';
import { X, ChevronDown, Save, Loader2, Plus, Trash2, Users, History } from 'lucide-react';
import api from '../../lib/api';
import './EditProjectModal.css';

const ROLE_LABELS = { autor: 'Autor', coautor: 'Co-autor', asesor: 'Asesor', jurado: 'Jurado' };
const ROLE_LABELS_PLURAL = { autor: 'Autores', coautor: 'Co-autores', asesor: 'Asesor(es)', jurado: 'Jurados' };
const ROLE_ORDER = ['autor', 'coautor', 'asesor', 'jurado'];

function Avatar({ name, size = 30 }) {
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

export default function EditProjectModal({ project, statuses, modalities, lines, sublines, degreeOptions = [], user, onClose, onSaved, onOpenHistory }) {
  const isAdmin = user?.role?.toLowerCase() === 'administrador';

  const [form, setForm] = useState({
    title: project.title || '',
    code: project.code || '',
    statusId: project.statusId || '',
    modalityId: project.modalityId || '',
    lineId: project.lineId || '',
    sublineId: project.sublineId || '',
    degreeOptionId: project.degreeOptionId ?? project.degree_option_id ?? '',
    letterLink: project.letterLink || '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');


  // ── Equipo del proyecto (solo admin) ──────────────────────────────────
  const initialTeam = [
    ...(project.authorsList || []).map(p => ({ id: p.id, name: p.name, email: p.email, role: p.role || 'autor' })),
    ...(project.advisorsList || []).map(p => ({ id: p.id, name: p.name, email: p.email, role: 'asesor' })),
    ...(project.jurorsList || []).map(p => ({ id: p.id, name: p.name, email: p.email, role: 'jurado' })),
  ];
  const [team, setTeam] = useState(initialTeam);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('asesor');
  const [verifying, setVerifying] = useState(false);
  const [teamError, setTeamError] = useState('');

  const targetProgramId = project?.programId ?? user?.programId ?? user?.program_id ?? null;
  const targetProgramName = String(project?.programName ?? user?.programName ?? user?.program_name ?? '').toLowerCase();
  const isPsicologia = String(targetProgramId) === '2' || targetProgramName.includes('psicolog');
  const isSistemas = String(targetProgramId) === '1' || targetProgramName.includes('sistema');

  const filteredLines = useMemo(() => {
    const allLines = lines || [];
    if (!allLines.length) return [];

    return allLines.filter(line => {
      if (line.program_id !== undefined && line.program_id !== null) {
        return String(line.program_id) === String(targetProgramId);
      }
      const name = (line.name || '').toLowerCase();
      if (isPsicologia) {
        return [4, 5, 6].includes(line.research_line_id) || name.includes('psicolog');
      }
      if (isSistemas) {
        return [1, 2, 3].includes(line.research_line_id) || (!name.includes('psicolog') && !name.includes('salud') && !name.includes('comunitaria'));
      }
      return true;
    });
  }, [lines, targetProgramId, isPsicologia, isSistemas]);

  const filteredSublines = useMemo(() => {
    if (!form.lineId) return [];

    return (sublines || []).filter(
      s => String(s.research_line_id) === String(form.lineId)
    );
  }, [sublines, form.lineId]);


  const handleAddTeamMember = async () => {
    const email = newEmail.trim();
    if (!email) return;
    setVerifying(true);
    setTeamError('');
    try {
      const res = await api.checkCoauthor(email);
      const found = res.user;
      if (!found) {
        setTeamError('Usuario no encontrado en el sistema.');
        return;
      }
      const exists = team.find(p => String(p.id) === String(found.user_id) && p.role === newRole);
      if (exists) {
        setTeamError('Esta persona ya tiene ese rol asignado en el proyecto.');
        return;
      }
      setTeam(prev => [...prev, { id: found.user_id, name: found.full_name, email: found.email, role: newRole }]);
      setNewEmail('');
    } catch (err) {
      setTeamError(err.message || 'Usuario no encontrado.');
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveTeamMember = (id, role) => {
    setTeam(prev => prev.filter(p => !(String(p.id) === String(id) && p.role === role)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('El título es obligatorio.'); return; }
    if (isAdmin && team.filter(p => p.role === 'autor' || p.role === 'coautor').length === 0) {
      setFormError('El proyecto debe tener al menos un autor.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        title: form.title.trim(),
        code: form.code.trim() || null,
        statusId: form.statusId ? Number(form.statusId) : null,
        modalityId: form.modalityId ? Number(form.modalityId) : null,
        lineId: form.lineId ? Number(form.lineId) : null,
        sublineId: form.sublineId ? Number(form.sublineId) : null,
        degreeOptionId: form.degreeOptionId ? Number(form.degreeOptionId) : null,
        letterLink: form.letterLink.trim() || null,
      };

      await api.updateProject(project.id, payload, user?.id);

      if (isAdmin) {
        await api.updateProjectParticipants(project.id, team.map(p => ({ id: p.id, role: p.role })), user?.id);
      }

      setFormSuccess('¡Proyecto actualizado correctamente!');
      setTimeout(() => { onSaved?.(); }, 1200);
    } catch (err) {
      setFormError(`No fue posible actualizar el proyecto: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="epm-backdrop" onClick={onClose}>
      <div className="epm-modal" onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div className="epm-header">
          <div>
            <span className="epm-eyebrow">Editar proyecto #{project.id}</span>
            <h2 className="epm-title">{project.title}</h2>
            <span className="epm-code">{project.code || 'Sin código'}</span>
          </div>
          <div className="epm-header-actions">
            <button className="epm-history-btn" type="button" onClick={onOpenHistory} title="Ver historial del proyecto">
              <History size={15} /> Historial
            </button>
            <button className="epm-close-btn" type="button" onClick={onClose} title="Cerrar"><X size={16} /></button>
          </div>
        </div>

        {/* BODY */}
        <div className="epm-body">
          <div className="epm-left">
            {(formError || formSuccess) && (
              <div className={`epm-alert ${formError ? 'epm-alert--error' : 'epm-alert--success'}`}>
                {formError || formSuccess}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="epm-section-title">Información del proyecto</div>

              <div className="epm-grid2">
                <div className="epm-field epm-span2">
                  <label>Título *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    required
                  />
                </div>

                <div className="epm-field">
                  <label>Estado</label>
                  <div className="epm-select-wrap">
                    <select value={form.statusId} onChange={e => setForm(p => ({ ...p, statusId: e.target.value }))}>
                      <option value="">— Selecciona —</option>
                      {statuses.map(s => <option key={s.status_id} value={s.status_id}>{s.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="epm-chevron" />
                  </div>
                </div>

                <div className="epm-field">
                  <label>Modalidad</label>
                  <div className="epm-select-wrap">
                    <select value={form.modalityId} onChange={e => setForm(p => ({ ...p, modalityId: e.target.value }))}>
                      <option value="">— Selecciona —</option>
                      {modalities.map(m => <option key={m.modality_id} value={m.modality_id}>{m.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="epm-chevron" />
                  </div>
                </div>

                <div className="epm-field">
                  <label>Opción de grado</label>
                  {isAdmin ? (
                    <div className="epm-select-wrap">
                      <select
                        value={form.degreeOptionId || ''}
                        onChange={e => setForm(p => ({ ...p, degreeOptionId: e.target.value }))}
                      >
                        <option value="">— Seleccione una opción —</option>
                        {(degreeOptions || []).map(opt => (
                          <option key={opt.degree_option_id} value={opt.degree_option_id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={13} className="epm-chevron" />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={
                        (degreeOptions || []).find(opt => String(opt.degree_option_id) === String(form.degreeOptionId))?.name
                        || project.degreeOptionName
                        || 'Opción de grado pendiente'
                      }
                      readOnly
                      disabled
                    />
                  )}
                </div>

                <div className="epm-field">
                  <label>Línea</label>
                  <div className="epm-select-wrap">
                    <select value={form.lineId} onChange={e => setForm(p => ({ ...p, lineId: e.target.value, sublineId: '' }))}>
                      <option value="">— Selecciona —</option>
                      {filteredLines.map(l => <option key={l.research_line_id} value={l.research_line_id}>{l.name}</option>)}
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
                  />
                </div>
              </div>

              {/* ── EQUIPO DEL PROYECTO (solo admin) ───────────────── */}
              {isAdmin && (
                <>
                  <div className="epm-section-title" style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} /> Equipo del proyecto
                  </div>

                  {teamError && <p className="epm-inline-error" style={{ marginBottom: 8 }}>{teamError}</p>}

                  {ROLE_ORDER.map(role => {
                    const members = team.filter(p => p.role === role);
                    return (
                      <div key={role} style={{ marginBottom: 12 }}>
                        <span style={{
                          fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '.06em', color: 'var(--text-muted)',
                        }}>
                          {ROLE_LABELS_PLURAL[role]}
                        </span>
                        {members.length === 0 ? (
                          <div className="epm-empty" style={{ padding: '8px 0' }}>Sin {ROLE_LABELS[role].toLowerCase()}(es) asignado(s).</div>
                        ) : (
                          members.map(p => (
                            <div key={`${role}-${p.id}`} className="epm-person-row">
                              <Avatar name={p.name} />
                              <div className="epm-person-info">
                                <span className="epm-person-name">{p.name}</span>
                                <span className="epm-person-role">{p.email}</span>
                              </div>
                              <div className="epm-person-actions">
                                <button
                                  type="button"
                                  className="epm-icon-btn epm-icon-btn--danger"
                                  title={`Quitar como ${ROLE_LABELS[role].toLowerCase()}`}
                                  onClick={() => handleRemoveTeamMember(p.id, role)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}

                  <div className="epm-add-row" style={{ alignItems: 'center' }}>
                    <Plus size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <input
                      className="epm-inline-input"
                      placeholder="Correo de la persona a agregar"
                      value={newEmail}
                      onChange={e => { setNewEmail(e.target.value); setTeamError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTeamMember(); } }}
                    />
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                      style={{
                        fontSize: '.78rem', padding: '6px 8px', borderRadius: 6,
                        border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                      }}
                    >
                      <option value="autor">Autor</option>
                      <option value="coautor">Co-autor</option>
                      <option value="asesor">Asesor</option>
                      <option value="jurado">Jurado</option>
                    </select>
                    <button type="button" className="epm-add-btn" onClick={handleAddTeamMember} disabled={verifying}>
                      {verifying ? <Loader2 size={12} className="epm-spin" /> : 'Agregar'}
                    </button>
                  </div>
                </>
              )}

              <div className="epm-form-actions">
                <button type="button" className="epm-btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="submit" className="epm-btn-primary" disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} className="epm-spin" /> Guardando...</>
                    : <><Save size={14} /> Guardar cambios</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
