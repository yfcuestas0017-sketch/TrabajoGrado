import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronDown, Mail, Pencil, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import { getSupabaseClient } from '../lib/supabase/client';
import { hasSupabaseConfig } from '../lib/supabase/config';

export default function GestionDocente() {
  const [docentes, setDocentes] = useState([]);
  const [lines, setLines] = useState([]);
  const [projects, setProjects] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Form state (assign)
  const [showForm, setShowForm] = useState(false);
  const [selectedDocenteId, setSelectedDocenteId] = useState('');
  const [assignLine, setAssignLine] = useState('');
  const [assignRole, setAssignRole] = useState('asesor');
  const [assignProject, setAssignProject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Create docente modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', password: '', program_id: '' });
  const [createError, setCreateError] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Detail panel state
  const [detailDocente, setDetailDocente] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);

  const loadData = useCallback(async () => {
    if (!hasSupabaseConfig) return;
    setLoading(true);
    const supabase = getSupabaseClient();

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id, users(user_id, full_name, email, program_id, programs(name))')
      .eq('role_id', 4);

    let docenteList = (roleData || [])
      .filter(r => r.users)
      .map(r => ({
        user_id: r.user_id,
        full_name: r.users.full_name || 'Sin nombre',
        email: r.users.email || '',
        program_id: r.users.program_id || null,
        program_name: r.users.programs?.name || null,
      }));

    if (docenteList.length > 0) {
      const { data: assignments } = await supabase
        .from('user_projects')
        .select('user_project_id, user_id, project_id, project_role, projects(title, code, research_line:research_lines(name))')
        .in('user_id', docenteList.map(d => d.user_id));

      const assignMap = {};
      (assignments || []).forEach(a => {
        if (!assignMap[a.user_id]) assignMap[a.user_id] = [];
        assignMap[a.user_id].push(a);
      });

      docenteList = docenteList.map(d => ({
        ...d,
        assignments: assignMap[d.user_id] || [],
      }));
    }

    const { data: linesData } = await supabase
      .from('research_lines').select('research_line_id, name').order('name');
    const { data: projectsData } = await supabase
      .from('projects').select('project_id, title, code').order('title');
    const { data: programsData } = await supabase
      .from('programs').select('program_id, name').order('name');

    setDocentes(docenteList);
    setLines(linesData || []);
    setProjects(projectsData || []);
    setPrograms(programsData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (detailDocente) {
      const updated = docentes.find(d => d.user_id === detailDocente.user_id);
      if (updated) setDetailDocente(updated);
    }
  }, [docentes]);

  const filtered = docentes.filter(d => {
    const t = search.toLowerCase();
    if (!t) return true;
    return d.full_name?.toLowerCase().includes(t) || d.email?.toLowerCase().includes(t);
  });

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedDocenteId('');
    setAssignLine('');
    setAssignRole('asesor');
    setAssignProject('');
    setFormError('');
    setFormSuccess('');
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedDocenteId) { setFormError('Selecciona un docente.'); return; }
    if (!assignProject) { setFormError('Selecciona un proyecto.'); return; }
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from('user_projects')
      .select('user_project_id')
      .eq('user_id', selectedDocenteId)
      .eq('project_id', Number(assignProject))
      .maybeSingle();

    if (existing) {
      const { error: upErr } = await supabase
        .from('user_projects')
        .update({ project_role: assignRole })
        .eq('user_project_id', existing.user_project_id);
      if (upErr) { setFormError(`Error: ${upErr.message}`); setSubmitting(false); return; }
      setFormSuccess(`Rol actualizado a "${assignRole}" correctamente.`);
    } else {
      const { error: insErr } = await supabase
        .from('user_projects')
        .insert({ user_id: selectedDocenteId, project_id: Number(assignProject), project_role: assignRole });
      if (insErr) { setFormError(`Error: ${insErr.message}`); setSubmitting(false); return; }
      setFormSuccess(`Docente asignado como "${assignRole}" correctamente.`);
    }

    setSubmitting(false);
    loadData();
  };

  const handleDeleteAssignment = async (userProjectId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta asignación?')) return;
    const supabase = getSupabaseClient();
    await supabase.from('user_projects').delete().eq('user_project_id', userProjectId);
    loadData();
  };

  const handleEditFromCard = (docente, assignment) => {
    setSelectedDocenteId(String(docente.user_id));
    setAssignRole(assignment.project_role || 'asesor');
    setAssignProject(String(assignment.project_id));
    setAssignLine('');
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDetail = (docente) => {
    setDetailDocente(docente);
    setActiveFilter(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseDetail = () => {
    setDetailDocente(null);
    setActiveFilter(null);
  };

  const handleStatClick = (filter) => {
    setActiveFilter(prev => prev === filter ? null : filter);
  };

  const getFilteredAssignments = () => {
    if (!detailDocente) return [];
    const all = detailDocente.assignments || [];
    if (!activeFilter) return all;
    return all.filter(a => a.project_role === activeFilter);
  };

  // ── CREATE DOCENTE ──
  const handleOpenCreateModal = () => {
    setCreateForm({ full_name: '', email: '', password: '', program_id: '' });
    setCreateError('');
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm({ full_name: '', email: '', password: '', program_id: '' });
    setCreateError('');
  };

  const handleCreateDocente = async (e) => {
    e.preventDefault();
    if (!createForm.full_name.trim()) { setCreateError('El nombre completo es obligatorio.'); return; }
    if (!createForm.email.trim()) { setCreateError('El correo electrónico es obligatorio.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createForm.email.trim())) { setCreateError('Ingresa un correo electrónico válido.'); return; }

    setCreateSubmitting(true);
    setCreateError('');
    const supabase = getSupabaseClient();

    // 1. Verificar si ya existe el email
    const { data: existing } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', createForm.email.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      setCreateError('Ya existe un usuario registrado con ese correo electrónico.');
      setCreateSubmitting(false);
      return;
    }

    // 2. Crear el usuario en la tabla users
    const insertPayload = {
      full_name: createForm.full_name.trim(),
      email: createForm.email.trim().toLowerCase(),
      ...(createForm.password.trim() && { password_hash: createForm.password.trim() }),
      ...(createForm.program_id && { program_id: Number(createForm.program_id) }),
    };

    const { data: newUser, error: userErr } = await supabase
      .from('users')
      .insert(insertPayload)
      .select('user_id')
      .single();

    if (userErr) {
      setCreateError(`Error al crear el usuario: ${userErr.message}`);
      setCreateSubmitting(false);
      return;
    }

    // 3. Asignar rol de docente (role_id = 4)
    const { error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: newUser.user_id, role_id: 4 });

    if (roleErr) {
      setCreateError(`Usuario creado pero ocurrió un error al asignar el rol: ${roleErr.message}`);
      setCreateSubmitting(false);
      return;
    }

    setCreateSubmitting(false);
    handleCloseCreateModal();
    loadData();
  };

  return (
    <DashboardLayout title="Gestión de Docentes" subtitle="">
      <div className="gd-page">

        {/* ── MODAL CREAR DOCENTE ── */}
        {showCreateModal && (
          <div className="gd-modal-overlay" onClick={handleCloseCreateModal}>
            <div className="gd-modal" onClick={e => e.stopPropagation()}>
              <div className="gd-modal-header">
                <div className="gd-modal-icon"><UserPlus size={18} /></div>
                <div>
                  <h3>Crear nuevo docente</h3>
                  <p>Completa los datos para registrar un nuevo docente en el sistema.</p>
                </div>
                <button className="gd-modal-close" type="button" onClick={handleCloseCreateModal}>
                  <X size={18} />
                </button>
              </div>

              {createError && (
                <div className="form-alert form-alert--error">{createError}</div>
              )}

              <form className="form-grid" onSubmit={handleCreateDocente}>
                <div className="field form-span">
                  <label className="field-label">Nombre completo *</label>
                  <input
                    className="field-input"
                    type="text"
                    placeholder="Ej: María García López"
                    value={createForm.full_name}
                    onChange={e => { setCreateForm(p => ({ ...p, full_name: e.target.value })); setCreateError(''); }}
                    autoFocus
                  />
                </div>

                <div className="field form-span">
                  <label className="field-label">Correo electrónico *</label>
                  <input
                    className="field-input"
                    type="email"
                    placeholder="docente@universidad.edu"
                    value={createForm.email}
                    onChange={e => { setCreateForm(p => ({ ...p, email: e.target.value })); setCreateError(''); }}
                  />
                </div>

                <div className="field form-span">
                  <label className="field-label">Programa</label>
                  <div className="select-wrap">
                    <select
                      className="field-input field-select"
                      value={createForm.program_id}
                      onChange={e => setCreateForm(p => ({ ...p, program_id: e.target.value }))}
                    >
                      <option value="">— Sin programa asignado —</option>
                      {programs.map(p => (
                        <option key={p.program_id} value={p.program_id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="select-chevron" />
                  </div>
                </div>

                <div className="field form-span">
                  <label className="field-label">Contraseña inicial</label>
                  <input
                    className="field-input"
                    type="password"
                    placeholder="Contraseña temporal (opcional)"
                    value={createForm.password}
                    onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                  />
                  <span className="field-hint">
                    Se asignará automáticamente el rol de Docente al guardar.
                  </span>
                </div>

                <div className="form-actions">
                  <Button variant="ghost" type="button" onClick={handleCloseCreateModal}>
                    Cancelar
                  </Button>
                  <Button variant="primary" type="submit" loading={createSubmitting}>
                    {createSubmitting ? 'Creando...' : 'Crear Docente'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── HERO ── */}
        <div className="gd-hero">
          <div className="gd-header">
            <div>
              <span className="gd-eyebrow">Panel administrativo</span>
              <h2 className="gd-title">Gestión de Docentes</h2>
              <p className="gd-subtitle">Visualiza docentes, asigna líneas de investigación y vincúlalos como asesor o jurado.</p>
            </div>
            <div className="gd-actions">
              <Button variant="primary" onClick={handleOpenCreateModal}>
                <UserPlus size={15} style={{ marginRight: 6 }} />
                Crear Docente
              </Button>
            </div>
          </div>
          <div className="gd-meta">
            <div className="gd-meta-card"><span className="gd-meta-label">Docentes</span><span className="gd-meta-value">{loading ? '--' : docentes.length}</span></div>
            <div className="gd-meta-card"><span className="gd-meta-label">Líneas</span><span className="gd-meta-value">{loading ? '--' : lines.length}</span></div>
            <div className="gd-meta-card"><span className="gd-meta-label">Proyectos</span><span className="gd-meta-value">{loading ? '--' : projects.length}</span></div>
          </div>
        </div>

        {error && <div className="gd-error">{error}</div>}

        {/* ── VISTA DETALLE ── */}
        {detailDocente ? (() => {
          const all = detailDocente.assignments || [];
          const totalJurado = all.filter(a => a.project_role === 'jurado').length;
          const totalAsesor = all.filter(a => a.project_role === 'asesor').length;
          const rolesUnicos = [...new Set(all.map(a => a.project_role).filter(Boolean))];
          const lineas = [...new Set(all.map(a => a.projects?.research_line?.name).filter(Boolean))];
          const filteredAssigns = getFilteredAssignments();

          return (
            <div className="dp-layout">
              <div className="dp-stats">
                <div className="dp-stat-card">
                  <div className="dp-stat-icon dp-stat-icon--blue"><Users size={20} /></div>
                  <div>
                    <span className="dp-stat-label">Proyectos a cargo</span>
                    <span className="dp-stat-value">{all.length}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`dp-stat-card dp-stat-card--btn${activeFilter === 'jurado' ? ' dp-stat-card--active-amber' : ''}`}
                  onClick={() => handleStatClick('jurado')}
                >
                  <div className="dp-stat-icon dp-stat-icon--amber"><BookOpen size={20} /></div>
                  <div>
                    <span className="dp-stat-label">Jurado de Proyectos</span>
                    <span className="dp-stat-value">{totalJurado}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`dp-stat-card dp-stat-card--btn${activeFilter === 'asesor' ? ' dp-stat-card--active-pink' : ''}`}
                  onClick={() => handleStatClick('asesor')}
                >
                  <div className="dp-stat-icon dp-stat-icon--pink"><Mail size={20} /></div>
                  <div>
                    <span className="dp-stat-label">Asesora de proyectos</span>
                    <span className="dp-stat-value">{totalAsesor}</span>
                  </div>
                </button>
              </div>

              <div className="dp-body">
                <div className="dp-profile">
                  <div className="dp-avatar">{detailDocente.full_name?.charAt(0)?.toUpperCase() || '?'}</div>
                  <span className="dp-name">{detailDocente.full_name}</span>
                </div>
                <div className="dp-divider" />
                <div className="dp-fields">
                  <div className="dp-field">
                    <label className="dp-field-label">Cargo</label>
                    <div className="dp-field-value">Docente</div>
                  </div>
                  <div className="dp-field">
                    <label className="dp-field-label">Correo</label>
                    <div className="dp-field-value">{detailDocente.email}</div>
                  </div>
                  {detailDocente.program_name && (
                    <div className="dp-field">
                      <label className="dp-field-label">Programa</label>
                      <div className="dp-field-value">{detailDocente.program_name}</div>
                    </div>
                  )}
                  {rolesUnicos.map((rol, i) => (
                    <div className="dp-field" key={i}>
                      <label className="dp-field-label">Rol</label>
                      <div className="dp-field-value" style={{ textTransform: 'capitalize' }}>{rol}</div>
                    </div>
                  ))}
                  {lineas.length > 0 && (
                    <div className="dp-field">
                      <label className="dp-field-label">Línea de investigación</label>
                      <div className="dp-field-value">{lineas.join(', ')}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="dp-projects-section">
                <div className="dp-projects-header">
                  <h3 className="dp-projects-title">
                    {activeFilter === 'jurado' && 'Proyectos como Jurado'}
                    {activeFilter === 'asesor' && 'Proyectos como Asesora'}
                    {!activeFilter && 'Todos los proyectos asignados'}
                  </h3>
                  {activeFilter && (
                    <button className="dp-clear-filter" onClick={() => setActiveFilter(null)}>
                      <X size={13} /> Mostrar todos
                    </button>
                  )}
                </div>

                {filteredAssigns.length === 0 ? (
                  <div className="dp-no-projects">Sin proyectos en esta categoría.</div>
                ) : (
                  <div className="dp-project-list">
                    {filteredAssigns.map((a, i) => (
                      <div key={i} className="dp-project-pill">
                        <span className={`dp-role-badge${a.project_role === 'jurado' ? ' dp-role-badge--jurado' : ''}`}>
                          {a.project_role}
                        </span>
                        <div className="dp-project-info">
                          {a.projects?.code && <span className="dp-project-code">{a.projects.code}</span>}
                          <span className="dp-project-title">{a.projects?.title || ''}</span>
                          {a.projects?.research_line?.name && (
                            <span className="dp-project-line">{a.projects.research_line.name}</span>
                          )}
                        </div>
                        <div className="gd-assign-actions">
                          <button type="button" className="gd-pill-btn" title="Editar" onClick={() => handleEditFromCard(detailDocente, a)}><Pencil size={13} /></button>
                          <button type="button" className="gd-pill-btn gd-pill-btn--danger" title="Eliminar" onClick={() => handleDeleteAssignment(a.user_project_id)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })() : (
          <>
            {/* ── FORMULARIO ASIGNAR ── */}
            {showForm && (
              <div className="form-card">
                <div className="form-header">
                  <div className="form-header-icon"><UserPlus size={18} /></div>
                  <div>
                    <h3>Asignar docente a proyecto</h3>
                    <p>Selecciona un docente, elige su rol y el proyecto al que será vinculado.</p>
                  </div>
                </div>

                {(formError || formSuccess) && (
                  <div className={`form-alert${formError ? ' form-alert--error' : ''}`}>
                    <span>{formError || formSuccess}</span>
                  </div>
                )}

                <form className="form-grid" onSubmit={handleAssign}>
                  <div className="field form-span">
                    <label className="field-label">Docente *</label>
                    <div className="select-wrap">
                      <select className="field-input field-select" value={selectedDocenteId} onChange={e => { setSelectedDocenteId(e.target.value); setFormError(''); setFormSuccess(''); }}>
                        <option value="">— Selecciona un docente —</option>
                        {docentes.map(d => (
                          <option key={d.user_id} value={d.user_id}>{d.full_name} ({d.email})</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="select-chevron" />
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">Línea de investigación</label>
                    <div className="select-wrap">
                      <select className="field-input field-select" value={assignLine} onChange={e => setAssignLine(e.target.value)}>
                        <option value="">— Selecciona línea (opcional) —</option>
                        {lines.map(l => (
                          <option key={l.research_line_id} value={l.research_line_id}>{l.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="select-chevron" />
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">Rol en el proyecto *</label>
                    <div className="select-wrap">
                      <select className="field-input field-select" value={assignRole} onChange={e => setAssignRole(e.target.value)}>
                        <option value="asesor">Asesor</option>
                        <option value="jurado">Jurado</option>
                      </select>
                      <ChevronDown size={14} className="select-chevron" />
                    </div>
                  </div>

                  <div className="field form-span">
                    <label className="field-label">Proyecto *</label>
                    <div className="select-wrap">
                      <select className="field-input field-select" value={assignProject} onChange={e => { setAssignProject(e.target.value); setFormError(''); }}>
                        <option value="">— Selecciona un proyecto —</option>
                        {projects.map(p => (
                          <option key={p.project_id} value={p.project_id}>{p.code ? `${p.code} — ` : ''}{p.title}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="select-chevron" />
                    </div>
                  </div>

                  <div className="form-actions">
                    <Button variant="ghost" type="button" onClick={handleCloseForm}>Cancelar</Button>
                    <Button variant="primary" type="submit" loading={submitting}>{submitting ? 'Guardando...' : 'Guardar asignación'}</Button>
                  </div>
                </form>
              </div>
            )}

            {/* ── BUSCADOR ── */}
            <div className="gd-search-bar">
              <Search size={16} className="gd-search-icon" />
              <input className="gd-search-input" type="text" placeholder="Buscar docente por nombre o correo..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* ── CARDS ── */}
            {loading ? (
              <div className="gd-empty">Cargando docentes...</div>
            ) : filtered.length === 0 ? (
              <div className="gd-empty">
                <Users size={40} />
                <h3>No se encontraron docentes</h3>
                <p>Asegúrate de que existan usuarios con el rol "Docente" (ID 4).</p>
              </div>
            ) : (
              <div className="gd-grid">
                {filtered.map(d => {
                  const asignaciones = d.assignments || [];
                  const asesorias = asignaciones.filter(a => a.project_role === 'asesor');
                  const jurados = asignaciones.filter(a => a.project_role === 'jurado');
                  const lineasSet = new Set();
                  asignaciones.forEach(a => { const ln = a.projects?.research_line?.name; if (ln) lineasSet.add(ln); });

                  return (
                    <div key={d.user_id} className="gd-card" onClick={() => handleOpenDetail(d)} style={{ cursor: 'pointer' }}>
                      <div className="gd-card-avatar">{d.full_name?.charAt(0)?.toUpperCase() || '?'}</div>
                      <div className="gd-card-body">
                        <h4 className="gd-card-name">{d.full_name}</h4>
                        <p className="gd-card-email"><Mail size={12} /> {d.email}</p>
                        {d.program_name && (
                          <p className="gd-card-program">{d.program_name}</p>
                        )}
                        {lineasSet.size > 0 && (
                          <div className="gd-card-lines">
                            <BookOpen size={12} />
                            {[...lineasSet].map((ln, i) => <span key={i} className="gd-tag">{ln}</span>)}
                          </div>
                        )}
                        <div className="gd-card-stats">
                          <span className="gd-stat">Asesorías: <strong>{asesorias.length}</strong></span>
                          <span className="gd-stat">Jurados: <strong>{jurados.length}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <GDStyle />
    </DashboardLayout>
  );
}

function GDStyle() {
  return (
    <style>{`
      .gd-page { display:flex; flex-direction:column; gap:20px; }

      .gd-hero {
        background: linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 14%, transparent), transparent 65%);
        border:1px solid var(--border-color); border-radius:var(--border-radius-xl);
        padding:22px 24px; box-shadow:var(--shadow-sm); display:flex; flex-direction:column; gap:18px;
      }
      .gd-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
      .gd-actions { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .gd-eyebrow { display:inline-flex; font-size:.7rem; text-transform:uppercase; letter-spacing:.12em; color:var(--text-muted); margin-bottom:8px; }
      .gd-title { font-family:var(--font-display); font-size:1.25rem; font-weight:700; color:var(--text-primary); letter-spacing:-.02em; }
      .gd-subtitle { color:var(--text-secondary); font-size:.9rem; margin-top:6px; }

      .gd-meta { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
      .gd-meta-card { background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--border-radius-lg); padding:14px 16px; display:flex; flex-direction:column; gap:4px; box-shadow:var(--shadow-sm); }
      .gd-meta-label { font-size:.7rem; text-transform:uppercase; letter-spacing:.08em; color:var(--text-muted); }
      .gd-meta-value { font-size:1.1rem; font-weight:700; color:var(--text-primary); }

      .gd-error { padding:12px 14px; border-radius:var(--border-radius-sm); border:1px solid color-mix(in srgb,var(--accent-danger)30%,var(--border-color)); background:color-mix(in srgb,var(--accent-danger)12%,transparent); color:var(--accent-danger); font-size:.85rem; }

      /* ── MODAL CREAR DOCENTE ── */
      .gd-modal-overlay {
        position:fixed; inset:0; z-index:200;
        background:color-mix(in srgb,#000 55%,transparent);
        backdrop-filter:blur(4px);
        display:flex; align-items:center; justify-content:center;
        padding:20px;
        animation:fadeIn .2s ease;
      }
      .gd-modal {
        background:var(--bg-card);
        border:1.5px solid color-mix(in srgb,var(--accent-primary)28%,var(--border-color));
        border-radius:var(--border-radius-xl);
        padding:26px 28px;
        width:100%; max-width:480px;
        box-shadow:0 20px 60px color-mix(in srgb,#000 30%,transparent),
                   0 0 0 1px color-mix(in srgb,var(--accent-primary)8%,transparent);
        animation:slideUp .25s ease;
      }
      .gd-modal-header {
        display:flex; align-items:flex-start; gap:14px;
        margin-bottom:20px; padding-bottom:16px;
        border-bottom:1px solid var(--border-color);
      }
      .gd-modal-icon {
        width:40px; height:40px; flex-shrink:0;
        background:color-mix(in srgb,var(--accent-primary)14%,transparent);
        color:var(--accent-primary); border-radius:11px;
        display:flex; align-items:center; justify-content:center;
      }
      .gd-modal-header h3 { margin:0 0 3px; font-size:1rem; font-weight:700; color:var(--text-primary); letter-spacing:-.02em; }
      .gd-modal-header p { margin:0; font-size:.82rem; color:var(--text-muted); }
      .gd-modal-close {
        margin-left:auto; flex-shrink:0;
        background:transparent; border:none;
        color:var(--text-muted); cursor:pointer;
        padding:6px; border-radius:7px;
        display:flex; align-items:center;
        transition:all var(--transition-fast);
      }
      .gd-modal-close:hover { background:var(--bg-secondary); color:var(--text-primary); }

      .field-hint { font-size:.72rem; color:var(--text-muted); margin-top:2px; }

      /* ── FORM ── */
      .form-card { background:var(--bg-card); border:1.5px solid color-mix(in srgb,var(--accent-primary)28%,var(--border-color)); border-radius:var(--border-radius-lg); padding:22px 24px; box-shadow:0 0 0 4px color-mix(in srgb,var(--accent-primary)6%,transparent),var(--shadow-sm); animation:fadeIn .25s ease; }
      .form-header { display:flex; align-items:center; gap:14px; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border-color); }
      .form-header-icon { width:38px; height:38px; background:color-mix(in srgb,var(--accent-primary)14%,transparent); color:var(--accent-primary); border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .form-header h3 { margin:0 0 3px; font-size:1rem; font-weight:700; color:var(--text-primary); letter-spacing:-.02em; }
      .form-header p { margin:0; color:var(--text-muted); font-size:.82rem; }
      .form-alert { margin-top:14px; padding:10px 12px; border-radius:var(--border-radius-sm); border:1px solid color-mix(in srgb,var(--accent-primary)40%,var(--border-color)); background:color-mix(in srgb,var(--accent-primary)12%,transparent); color:var(--text-primary); font-size:.82rem; }
      .form-alert--error { border-color:color-mix(in srgb,var(--accent-danger)40%,var(--border-color)); background:color-mix(in srgb,var(--accent-danger)12%,transparent); color:var(--accent-danger); }
      .form-grid { margin-top:16px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
      .form-span { grid-column:span 2; }
      .form-actions { grid-column:span 2; display:flex; justify-content:flex-end; gap:10px; margin-top:6px; }

      .field { display:flex; flex-direction:column; gap:6px; }
      .field-label { font-size:.78rem; font-weight:600; color:var(--text-primary); letter-spacing:-.01em; }
      .field-input { width:100%; padding:10px 13px; border:1.5px solid var(--border-color); border-radius:var(--border-radius-sm); background:var(--bg-secondary); font-size:.88rem; font-family:var(--font-body); color:var(--text-primary); outline:none; transition:border-color var(--transition-fast),box-shadow var(--transition-fast); box-sizing:border-box; }
      .field-input:focus { border-color:var(--accent-primary); box-shadow:0 0 0 3px color-mix(in srgb,var(--accent-primary)14%,transparent); }
      .select-wrap { position:relative; }
      .field-select { appearance:none; padding-right:34px; cursor:pointer; }
      .select-chevron { position:absolute; right:11px; top:50%; transform:translateY(-50%); color:var(--text-muted); pointer-events:none; }

      /* ── SEARCH ── */
      .gd-search-bar { position:relative; }
      .gd-search-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--text-muted); }
      .gd-search-input { width:100%; padding:12px 14px 12px 38px; border:1.5px solid var(--border-color); border-radius:var(--border-radius-sm); background:var(--bg-card); font-size:.88rem; font-family:var(--font-body); color:var(--text-primary); outline:none; transition:border-color var(--transition-fast); box-shadow:var(--shadow-sm); box-sizing:border-box; }
      .gd-search-input:focus { border-color:var(--accent-primary); box-shadow:0 0 0 3px color-mix(in srgb,var(--accent-primary)14%,transparent); }

      /* ── EMPTY ── */
      .gd-empty { text-align:center; padding:60px 20px; color:var(--text-muted); background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--border-radius-lg); box-shadow:var(--shadow-sm); }
      .gd-empty h3 { color:var(--text-primary); margin:12px 0 6px; font-size:1.05rem; }
      .gd-empty p { font-size:.85rem; max-width:400px; margin:0 auto; }

      /* ── CARDS GRID ── */
      .gd-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
      .gd-card { background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--border-radius-lg); padding:20px; box-shadow:var(--shadow-sm); display:flex; gap:16px; align-items:flex-start; transition:border-color var(--transition-fast),box-shadow var(--transition-fast),transform var(--transition-fast); }
      .gd-card:hover { border-color:color-mix(in srgb,var(--accent-primary)40%,var(--border-color)); box-shadow:var(--shadow-md); transform:translateY(-2px); }
      .gd-card-avatar { width:48px; height:48px; border-radius:14px; flex-shrink:0; background:linear-gradient(135deg, var(--accent-primary), color-mix(in srgb,var(--accent-primary)60%,#000)); color:#fff; font-weight:700; font-size:1.1rem; display:flex; align-items:center; justify-content:center; }
      .gd-card-body { flex:1; min-width:0; }
      .gd-card-name { font-size:.95rem; font-weight:700; color:var(--text-primary); margin:0 0 4px; }
      .gd-card-email { font-size:.78rem; color:var(--text-muted); display:flex; align-items:center; gap:5px; margin:0 0 4px; }
      .gd-card-program { font-size:.75rem; color:var(--accent-primary); font-weight:600; margin:0 0 8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .gd-card-lines { display:flex; flex-wrap:wrap; gap:5px; align-items:center; margin-bottom:8px; color:var(--text-muted); }
      .gd-tag { font-size:.68rem; padding:3px 8px; border-radius:999px; background:color-mix(in srgb,var(--accent-info)15%,transparent); color:var(--accent-info); font-weight:600; }
      .gd-card-stats { display:flex; gap:14px; }
      .gd-stat { font-size:.75rem; color:var(--text-muted); }
      .gd-stat strong { color:var(--text-primary); }

      .gd-assign-actions { display:flex; gap:4px; margin-left:auto; flex-shrink:0; }
      .gd-pill-btn { background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:5px; border-radius:5px; display:flex; align-items:center; justify-content:center; transition:all var(--transition-fast); }
      .gd-pill-btn:hover { background:var(--bg-secondary); color:var(--accent-primary); }
      .gd-pill-btn--danger:hover { color:var(--accent-danger); }

      /* ── DETAIL PANEL ── */
      .dp-layout { display:flex; flex-direction:column; gap:20px; animation:fadeIn .3s ease; }

      .dp-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
      .dp-stat-card { display:flex; align-items:center; gap:12px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--border-radius-lg); padding:16px 18px; box-shadow:var(--shadow-sm); text-align:left; }
      .dp-stat-card--btn { cursor:pointer; transition:border-color var(--transition-fast),box-shadow var(--transition-fast),transform var(--transition-fast); }
      .dp-stat-card--btn:hover { border-color:color-mix(in srgb,var(--accent-primary)35%,var(--border-color)); box-shadow:var(--shadow-md); transform:translateY(-1px); }
      .dp-stat-card--active-amber { border-color:#d97706 !important; box-shadow:0 0 0 3px color-mix(in srgb,#f59e0b 18%,transparent) !important; }
      .dp-stat-card--active-pink { border-color:#db2777 !important; box-shadow:0 0 0 3px color-mix(in srgb,#ec4899 18%,transparent) !important; }

      .dp-stat-icon { width:42px; height:42px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
      .dp-stat-icon--blue { background:color-mix(in srgb,var(--accent-info)15%,transparent); color:var(--accent-info); }
      .dp-stat-icon--amber { background:color-mix(in srgb,#f59e0b 15%,transparent); color:#d97706; }
      .dp-stat-icon--pink { background:color-mix(in srgb,#ec4899 15%,transparent); color:#db2777; }
      .dp-stat-label { display:block; font-size:.72rem; color:var(--text-muted); margin-bottom:3px; }
      .dp-stat-value { display:block; font-size:1.3rem; font-weight:700; color:var(--text-primary); }

      .dp-body { background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--border-radius-lg); padding:24px 28px; box-shadow:var(--shadow-sm); }
      .dp-profile { display:flex; flex-direction:column; align-items:center; gap:10px; margin-bottom:20px; }
      .dp-avatar { width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg, var(--accent-primary), color-mix(in srgb,var(--accent-primary)60%,#000)); color:#fff; font-weight:700; font-size:1.9rem; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 3px var(--bg-card), 0 0 0 5px color-mix(in srgb,var(--accent-primary)35%,transparent); }
      .dp-name { font-size:1.05rem; font-weight:700; color:var(--text-primary); }
      .dp-divider { border:none; border-top:1px solid var(--border-color); margin:0 0 20px; }
      .dp-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
      .dp-field { display:flex; flex-direction:column; gap:5px; }
      .dp-field-label { font-size:.7rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.07em; }
      .dp-field-value { font-size:.88rem; color:var(--text-primary); background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--border-radius-sm); padding:9px 12px; }

      .dp-projects-section { background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--border-radius-lg); padding:20px 24px; box-shadow:var(--shadow-sm); }
      .dp-projects-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
      .dp-projects-title { font-size:.95rem; font-weight:700; color:var(--text-primary); margin:0; }
      .dp-clear-filter { display:flex; align-items:center; gap:5px; font-size:.75rem; color:var(--text-muted); background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:5px 10px; cursor:pointer; transition:all var(--transition-fast); }
      .dp-clear-filter:hover { color:var(--text-primary); }
      .dp-no-projects { text-align:center; padding:30px; color:var(--text-muted); font-size:.85rem; }
      .dp-project-list { display:flex; flex-direction:column; gap:8px; }
      .dp-project-pill { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--border-radius-sm); transition:border-color var(--transition-fast); }
      .dp-project-pill:hover { border-color:color-mix(in srgb,var(--accent-primary)25%,var(--border-color)); }
      .dp-role-badge { padding:3px 8px; border-radius:999px; font-size:.65rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:color-mix(in srgb,var(--accent-success)18%,transparent); color:var(--accent-success); flex-shrink:0; }
      .dp-role-badge--jurado { background:color-mix(in srgb,var(--accent-info)18%,transparent); color:var(--accent-info); }
      .dp-project-info { display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }
      .dp-project-code { font-size:.72rem; color:var(--text-muted); font-weight:600; }
      .dp-project-title { font-size:.85rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .dp-project-line { font-size:.72rem; color:var(--accent-info); }

      @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      @keyframes slideUp { from{opacity:0;transform:translateY(20px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }

      @media(max-width:768px) {
        .gd-grid { grid-template-columns:1fr; }
        .gd-meta,.dp-stats,.dp-fields { grid-template-columns:1fr; }
        .form-grid { grid-template-columns:1fr; }
        .form-span { grid-column:span 1; }
        .form-actions { grid-column:span 1; }
        .gd-card { flex-direction:column; }
        .dp-body { padding:20px 16px; }
        .gd-modal { padding:20px 16px; }
      }
    `}</style>
  );
}