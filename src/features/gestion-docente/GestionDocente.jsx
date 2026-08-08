import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, ChevronDown, Mail, Pencil, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import { getSupabaseClient } from '../../lib/supabase/client';
import { hasSupabaseConfig } from '../../lib/supabase/config';
import { useAuth } from '../../context/AuthContext';
import './GestionDocente.css';

export default function GestionDocente() {
  const { user } = useAuth();

  // Si el usuario es administrador y tiene programa asignado, solo verá ese programa
  const adminProgramId = user?.role?.toLowerCase() === 'administrador' ? (user?.programId ?? null) : null;

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

  // Add docente modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearchEmail, setAddSearchEmail] = useState('');
  const [addSearchResult, setAddSearchResult] = useState(null);
  const [addSearching, setAddSearching] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

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
        user_id: r.users.user_id || r.user_id,
        full_name: r.users.full_name || 'Sin nombre',
        email: r.users.email || '',
        program_id: r.users.program_id || null,
        program_name: r.users.programs?.name || null,
      }));

    // ── FILTRO POR PROGRAMA DEL ADMINISTRADOR ──────────────────
    // Si el admin pertenece a un programa específico, solo ve docentes de ese programa
    if (adminProgramId !== null) {
      docenteList = docenteList.filter(d => String(d.program_id) === String(adminProgramId));
    }

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

    // ── PROYECTOS FILTRADOS POR PROGRAMA ───────────────────────
    // Si el admin tiene programa, solo carga proyectos de ese programa
    let projectsQuery = supabase.from('projects').select('project_id, title, code').order('title');
    if (adminProgramId !== null) {
      const { data: programUserProjects } = await supabase
        .from('user_projects')
        .select('project_id, users!inner(program_id)')
        .eq('users.program_id', adminProgramId);
      const programProjectIds = [...new Set((programUserProjects || []).map(r => r.project_id))];
      if (programProjectIds.length > 0) {
        projectsQuery = projectsQuery.in('project_id', programProjectIds);
      } else {
        // No hay proyectos para este programa
        setDocentes(docenteList);
        setLines(linesData || []);
        setProjects([]);
        const { data: programsData } = await supabase.from('programs').select('program_id, name').order('name');
        setPrograms(programsData || []);
        setLoading(false);
        return;
      }
    }

    const { data: projectsData } = await projectsQuery;
    const { data: programsData } = await supabase
      .from('programs').select('program_id, name').order('name');

    setDocentes(docenteList);
    setLines(linesData || []);
    setProjects(projectsData || []);
    setPrograms(programsData || []);
    setLoading(false);
  }, [adminProgramId]);

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

  // ── AGREGAR DOCENTE ──
  const handleOpenAddModal = () => {
    setAddSearchEmail('');
    setAddSearchResult(null);
    setAddError('');
    setAddSuccess('');
    setAddSearching(false);
    setAddSubmitting(false);
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setAddSearchEmail('');
    setAddSearchResult(null);
    setAddError('');
    setAddSuccess('');
    setAddSearching(false);
    setAddSubmitting(false);
  };

  const handleSearchAdd = async (e) => {
    e.preventDefault();
    const email = addSearchEmail.trim().toLowerCase();
    if (!email) { setAddError('Ingresa un correo electrónico.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setAddError('Ingresa un correo electrónico válido.'); return; }

    setAddSearching(true);
    setAddError('');
    setAddSuccess('');
    setAddSearchResult(null);

    const supabase = getSupabaseClient();
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('user_id, full_name, email, program_id, programs(name)')
      .eq('email', email)
      .maybeSingle();

    if (userErr) {
      setAddError(`No fue posible buscar el usuario: ${userErr.message}`);
      setAddSearching(false);
      return;
    }

    if (!userRow) {
      setAddError('No se encontró un usuario con ese correo.');
      setAddSearching(false);
      return;
    }

    if (adminProgramId !== null && String(userRow.program_id) !== String(adminProgramId)) {
      setAddError('El usuario no pertenece a tu programa.');
      setAddSearching(false);
      return;
    }

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userRow.user_id)
      .eq('role_id', 4)
      .maybeSingle();

    const alreadyDocente = Boolean(roleRow);
    setAddSearchResult({
      ...userRow,
      program_name: userRow.programs?.name || null,
      alreadyDocente,
    });
    setAddSuccess(alreadyDocente
      ? 'Este usuario ya tiene el rol de Docente.'
      : 'Usuario encontrado. Puedes agregarlo como docente.');
    setAddSearching(false);
  };

  const handleAddDocente = async () => {
    if (!addSearchResult) { setAddError('Busca un usuario primero.'); return; }
    if (addSearchResult.alreadyDocente) { setAddError('Este usuario ya es docente.'); return; }

    setAddSubmitting(true);
    setAddError('');
    setAddSuccess('');
    const supabase = getSupabaseClient();

    const { error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: addSearchResult.user_id, role_id: 4 });

    if (roleErr) {
      setAddError(`No se pudo agregar el rol de docente: ${roleErr.message}`);
      setAddSubmitting(false);
      return;
    }

    setAddSearchResult((prev) => prev ? { ...prev, alreadyDocente: true } : prev);
    setAddSuccess('Docente agregado correctamente.');
    setAddSubmitting(false);
    loadData();
  };

  return (
    <DashboardLayout title="Gestión de Docentes" subtitle="">
      <div className="gd-page">

        {/* ── MODAL AGREGAR DOCENTE ── */}
        {showAddModal && (
          <div className="gd-modal-overlay" onClick={handleCloseAddModal}>
            <div className="gd-modal" onClick={e => e.stopPropagation()}>
              <div className="gd-modal-header">
                <div className="gd-modal-icon"><UserPlus size={18} /></div>
                <div>
                  <h3>Agregar docente existente</h3>
                  <p>Busca por correo y agrega el rol de Docente si el usuario ya existe.</p>
                </div>
                <button className="gd-modal-close" type="button" onClick={handleCloseAddModal}>
                  <X size={18} />
                </button>
              </div>

              {(addError || addSuccess) && (
                <div className={`form-alert${addError ? ' form-alert--error' : ''}`}>
                  <span>{addError || addSuccess}</span>
                </div>
              )}

              <form className="gd-add-form" onSubmit={handleSearchAdd}>
                <div className="field form-span">
                  <label className="field-label">Correo electrónico *</label>
                  <input
                    className="field-input"
                    type="email"
                    placeholder="docente@universidad.edu"
                    value={addSearchEmail}
                    onChange={e => { setAddSearchEmail(e.target.value); setAddError(''); setAddSuccess(''); }}
                    autoFocus
                  />
                </div>
                <div className="gd-add-actions">
                  <Button variant="ghost" type="button" onClick={handleCloseAddModal}>
                    Cancelar
                  </Button>
                  <Button variant="primary" type="submit" loading={addSearching}>
                    {addSearching ? 'Buscando...' : 'Buscar usuario'}
                  </Button>
                </div>
              </form>

              {addSearchResult && (
                <div className="gd-add-result">
                  <div className="gd-add-avatar">
                    {addSearchResult.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="gd-add-info">
                    <span className="gd-add-name">{addSearchResult.full_name || 'Sin nombre'}</span>
                    <span className="gd-add-email">{addSearchResult.email}</span>
                    {addSearchResult.program_name && (
                      <span className="gd-add-program">{addSearchResult.program_name}</span>
                    )}
                  </div>
                  <div className={`gd-add-status${addSearchResult.alreadyDocente ? ' gd-add-status--done' : ''}`}>
                    <Check size={14} />
                    {addSearchResult.alreadyDocente ? 'Docente' : 'Listo para agregar'}
                  </div>
                </div>
              )}

              <div className="gd-add-actions" style={{ marginTop: 14 }}>
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleAddDocente}
                  loading={addSubmitting}
                  disabled={!addSearchResult || addSearchResult.alreadyDocente}
                >
                  {addSearchResult?.alreadyDocente ? 'Ya es docente' : (addSubmitting ? 'Agregando...' : 'Agregar Docente')}
                </Button>
              </div>
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
              {/* Badge que muestra el programa filtrado (solo visible para admins con programa) */}
              {adminProgramId !== null && programs.length > 0 && (() => {
                const prog = programs.find(p => String(p.program_id) === String(adminProgramId));
                return prog ? (
                  <div className="gd-program-badge">
                    <span className="gd-program-dot" />
                    Mostrando solo: <strong>{prog.name}</strong>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="gd-actions">
              <Button variant="primary" onClick={handleOpenAddModal}>
                <UserPlus size={15} style={{ marginRight: 6 }} />
                Agregar Docente
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
    </DashboardLayout>
  );
}

