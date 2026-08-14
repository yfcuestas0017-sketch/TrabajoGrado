import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, BookOpen, ChevronDown, Download, ExternalLink, Eye, FilePlus2, Filter, History, Pencil,
  Settings, Trash2, Upload, Users, X,
} from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import EditProjectModal from './EditProjectModal';
import CrearProyecto from './CrearProyecto';
import api from '../../lib/api';
import { generatePrefix } from './generatePrefix';
import './ProyectosPage.css';

export function ProyectosPage() {
  const { user } = useAuth();
  const isStudent = user?.role?.toLowerCase() === 'estudiante';
  const isDocente = user?.role?.toLowerCase() === 'docente';
  const isLimitedUser = isStudent || isDocente;

  const adminProgramId = user?.role?.toLowerCase() === 'administrador' ? (user?.programId ?? null) : null;

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    modality: 'all',
    year: 'all',
    docenteRole: 'all',
  });
  const [selectedId, setSelectedId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [lines, setLines] = useState([]);
  const [sublines, setSublines] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    code: '',
    statusId: '',
    modalityId: '',
    lineId: '',
    sublineId: '',
    letterLink: '',
    coauthors: [],
  });

  const [adminProgramName, setAdminProgramName] = useState('');
  const [verifyingCoauthor, setVerifyingCoauthor] = useState(false);
  const [newCoauthorEmail, setNewCoauthorEmail] = useState('');
  const [editProjectId, setEditProjectId] = useState(null);

  const [detailModal, setDetailModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [editModal, setEditModal] = useState(null);

  const openEditForm = (project) => {
    setFormData({
      title: project.title || '',
      code: project.code || '',
      statusId: project.statusId || '',
      modalityId: project.modalityId || '',
      lineId: project.lineId || '',
      sublineId: project.sublineId || '',
      letterLink: project.letterLink || '',
      coauthors: project.coauthors || [],
    });
    setEditProjectId(project.id);
    setShowForm(true);
    setFormError('');
    setFormSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditProjectId(null);
    setFormData({
      title: '', code: '', statusId: '', modalityId: '', lineId: '', sublineId: '', letterLink: '', coauthors: [],
    });
    setNewCoauthorEmail('');
  };

  const fetchHistory = async (projectId) => {
    if (!projectId) return;

    setHistoryLoading(true);
    try {
      const data = await api.getProjectHistory(projectId);
      const mappedHistory = (data ?? []).map((history) => {
        const title = history.description || 'Actualización registrada';
        const detail = history.modified_field
          ? `${history.modified_field}: ${history.old_value ?? '-'} -> ${history.new_value ?? '-'}`
          : history.change_type || 'Actualización';
        const date = history.changed_at
          ? new Date(history.changed_at).toLocaleDateString('es-CO')
          : 'Sin fecha';

        return { id: history.history_id, title, detail, date };
      });
      setHistoryItems(mappedHistory);
    } catch (_) {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [allProjects, catalogs] = await Promise.all([
        api.getProjects(),
        api.getCatalogs(),
      ]);

      setStatuses(catalogs.statuses || []);
      setModalities(catalogs.modalities || []);
      setLines(catalogs.lines || []);
      setSublines(catalogs.sublines || []);

      let userProjects = allProjects || [];

      if (isLimitedUser && user?.id) {
        userProjects = userProjects.filter(p =>
          (p.user_projects || []).some(up => String(up.user_id) === String(user.id))
        );
      }

      if (adminProgramId !== null && !isLimitedUser) {
        userProjects = userProjects.filter(p =>
          (p.user_projects || []).some(up => String(up.program_id) === String(adminProgramId))
        );
      }

      const mappedProjects = userProjects.map((row) => {
        const year = row.created_at
          ? new Date(row.created_at).getFullYear().toString()
          : 'Sin fecha';
        const authorsArray = (row.authors || []).map(a => a.name).filter(Boolean);
        const asesores = (row.advisors || []).map(a => a.name).filter(Boolean);
        const juradosArray = (row.jurors || []).map(a => a.name).filter(Boolean);

        return {
          id: row.project_id,
          code: row.code || `PR-${row.project_id}`,
          title: row.title,
          status: row.status || 'Sin estado',
          statusId: row.statusId || '',
          modality: row.modality || 'Sin modalidad',
          modalityId: row.modalityId || '',
          line: row.line || 'Sin línea',
          lineId: row.lineId || '',
          subline: row.subline || 'Sin sublínea',
          sublineId: row.sublineId || '',
          year,
          authorsArray: authorsArray.length > 0 ? authorsArray : ['Sin autores'],
          advisor: asesores.length > 0 ? asesores.join(', ') : 'Sin asignar',
          jurados: juradosArray.length > 0 ? juradosArray.join(', ') : 'Sin jurados',
          updatedAt: row.created_at,
          description: row.letterLink
            ? `Carta: ${row.letterLink}`
            : 'Sin descripción registrada.',
          letterLink: row.letterLink || '',
          isOwned: (row.user_projects || []).some(up => String(up.user_id) === String(user?.id)),
          coauthors: row.authors || [],
          authorsList: row.authors || [],
          advisorsList: row.advisors || [],
          jurorsList: row.jurors || [],
          myRole: (row.user_projects || []).find(p => String(p.user_id) === String(user?.id))?.project_role || null,
        };
      });

      setProjects(mappedProjects);
      setSelectedId(mappedProjects[0]?.id ?? null);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('No fue posible cargar los proyectos desde la base de datos.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role, isLimitedUser, adminProgramId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedId) return;
    fetchHistory(selectedId);
  }, [selectedId]);

  const years = useMemo(() => {
    const values = new Set(['all']);

    projects.forEach((project) => {
      if (project.year) values.add(project.year);
    });

    return Array.from(values);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const term = filters.search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesText =
        !term ||
        project.title.toLowerCase().includes(term) ||
        project.code.toLowerCase().includes(term) ||
        project.authorsArray.some(a => a.toLowerCase().includes(term));
      const matchesStatus =
        filters.status === 'all' || project.status === filters.status;
      const matchesModality =
        filters.modality === 'all' || project.modality === filters.modality;
      const matchesYear =
        filters.year === 'all' ||
        project.year === filters.year;

      const matchesDocenteRole =
        !isDocente ||
        filters.docenteRole === 'all' ||
        project.myRole === filters.docenteRole;

      return matchesText && matchesStatus && matchesModality && matchesYear && matchesDocenteRole;
    });
  }, [filters, projects, isDocente]);

  const selectedProject =
    projects.find((project) => project.id === selectedId) || projects[0];

  const metaCounts = useMemo(() => ({
    total: projects.length,
    estados: statuses.length,
    modalidades: modalities.length,
  }), [projects.length, statuses.length, modalities.length]);

  const handleFilterChange = (key) => (event) => {
    setFilters((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const filteredSublines = useMemo(() => {
    if (!formData.lineId) return sublines;
    return sublines.filter(
      (item) => String(item.research_line_id) === String(formData.lineId),
    );
  }, [formData.lineId, sublines]);

  const handleFormChange = (key) => (event) => {
    setFormData((prev) => ({ ...prev, [key]: event.target.value }));
    setFormError('');
    setFormSuccess('');
  };

  const verifyAndAddAuthor = async () => {
    const email = newCoauthorEmail.trim().toLowerCase();
    if (!email) return;

    if (email === user?.email?.toLowerCase()) {
      setFormError('No puedes agregarte a ti mismo como co-autor (ya estás incluido).');
      return;
    }

    if (formData.coauthors.some(c => c.email.toLowerCase() === email)) {
      setFormError('Este co-autor ya está agregado.');
      return;
    }

    setVerifyingCoauthor(true);
    setFormError('');

    try {
      const res = await api.checkCoauthor(email);
      const data = res.user;
      if (!data) {
        setFormError('Usuario no encontrado. Asegúrate de que el compañero ya se haya registrado en el sistema.');
      } else {
        setFormData(prev => ({
          ...prev,
          coauthors: [...prev.coauthors, { id: data.user_id, name: data.full_name, email: data.email }]
        }));
        setNewCoauthorEmail('');
      }
    } catch (err) {
      setFormError('Error al verificar el correo: ' + (err.message || ''));
    } finally {
      setVerifyingCoauthor(false);
    }
  };

  const removeCoauthor = (idToRemove) => {
    setFormData(prev => ({
      ...prev,
      coauthors: prev.coauthors.filter(c => c.id !== idToRemove)
    }));
  };

  useEffect(() => {
    if (editProjectId || !formData.lineId) return;
    let isMounted = true;

    const generateCode = async () => {
      setIsGeneratingCode(true);
      try {
        const line = lines.find((l) => String(l.research_line_id) === String(formData.lineId));
        const prefix = generatePrefix(line?.name);

        const existingProjects = await api.getProjects();
        let maxNum = 0;
        (existingProjects || []).forEach(row => {
          if (!row.code) return;
          const parts = row.code.split('-');
          if (parts.length > 1) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });
        
        if (isMounted) {
          setFormData(prev => ({ ...prev, code: `${prefix}-${maxNum + 1}` }));
        }
      } catch (err) {
        console.error('Error generando codigo:', err);
      } finally {
        if (isMounted) setIsGeneratingCode(false);
      }
    };

    generateCode();
    return () => { isMounted = false; };
  }, [formData.lineId, editProjectId, lines]);

  const handleSaveProject = async (event) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      setFormError('El título es obligatorio.');
      return;
    }

    if (!formData.statusId || !formData.modalityId) {
      setFormError('Selecciona estado y modalidad.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    const payload = {
      title: formData.title.trim(),
      code: formData.code.trim() || null,
      statusId: Number(formData.statusId) || null,
      modalityId: Number(formData.modalityId) || null,
      lineId: formData.lineId ? Number(formData.lineId) : null,
      sublineId: formData.sublineId ? Number(formData.sublineId) : null,
      letterLink: formData.letterLink.trim() || null,
      creatorUserId: user?.id,
      coauthors: formData.coauthors,
    };

    try {
      if (editProjectId) {
        await api.updateProject(editProjectId, payload);
        setFormSuccess('Proyecto actualizado correctamente.');
      } else {
        await api.createProject(payload);
        setFormSuccess('Proyecto creado correctamente.');
      }
      setTimeout(() => {
        handleCloseForm();
        loadData();
      }, 1000);
    } catch (err) {
      setFormError(`No fue posible guardar el proyecto: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Gestion de Proyectos" subtitle="">
      <div className="projects-page">
        <div className="projects-hero">
          <div className="projects-header">
            <div>
              <span className="section-eyebrow">Gestion de datos</span>
              <h2 className="section-title">Gestion operativa</h2>
              <p className="section-subtitle">
                Administra proyectos, consulta historial y exporta informacion.
              </p>
              {adminProgramId !== null && (
                  <div className="prog-filter-badge">
                    <span className="prog-filter-dot" />
                    Mostrando solo: <strong>{adminProgramName || 'tu programa'}</strong>
                  </div>
                )}
            </div>
            <div className="projects-actions">
              {!isDocente && (
                <Button
                  variant="primary"
                  icon={FilePlus2}
                  onClick={() => setShowCrearModal(true)}
                >
                  Agregar proyecto
                </Button>
              )}
            </div>
          </div>

          <div className="projects-meta">
            <div className="meta-card">
              <span className="meta-label">Proyectos</span>
              <span className="meta-value">{loading ? '--' : metaCounts.total}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Estados</span>
              <span className="meta-value">{loading ? '--' : metaCounts.estados}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Modalidades</span>
              <span className="meta-value">{loading ? '--' : metaCounts.modalidades}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="page-error">
            <span>{error}</span>
          </div>
        )}

        {showForm && (
          <div className="form-card">
            <div className="form-header">
              <div className="form-header-icon">
                <FilePlus2 size={18} />
              </div>
              <div>
                <h3>{editProjectId ? 'Editar proyecto' : 'Registrar proyecto'}</h3>
                <p>{editProjectId ? 'Actualiza los datos del proyecto.' : 'Completa los datos para registrar el nuevo proyecto de grado.'}</p>
              </div>
            </div>

            {(formError || formSuccess) && (
              <div className={`form-alert${formError ? ' form-alert--error' : ''}`}>
                <span>{formError || formSuccess}</span>
              </div>
            )}

            <form className="form-grid" onSubmit={handleSaveProject}>
              <div className="field">
                <label className="field-label">Título del proyecto *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={handleFormChange('title')}
                  className="field-input"
                  placeholder="Ej: Sistema de gestión académica..."
                  required
                />
              </div>
              <div className="field">
                <label className="field-label">Código (Autogenerado)</label>
                <input
                  type="text"
                  value={isGeneratingCode ? 'Generando...' : formData.code}
                  readOnly
                  className="field-input"
                  placeholder="Selecciona una línea de investigación"
                  style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed', color: 'var(--text-secondary)' }}
                />
              </div>
              <div className="field">
                <label className="field-label">Estado *</label>
                <div className="select-wrap">
                  <select
                    className="field-input field-select"
                    value={formData.statusId}
                    onChange={handleFormChange('statusId')}
                    required
                  >
                    <option value="">— Selecciona un estado —</option>
                    {statuses.map((status) => (
                      <option key={status.status_id} value={status.status_id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="select-chevron" />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Modalidad *</label>
                <div className="select-wrap">
                  <select
                    className="field-input field-select"
                    value={formData.modalityId}
                    onChange={handleFormChange('modalityId')}
                    required
                  >
                    <option value="">— Selecciona una modalidad —</option>
                    {modalities.map((modality) => (
                      <option key={modality.modality_id} value={modality.modality_id}>
                        {modality.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="select-chevron" />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Línea de investigación</label>
                <div className="select-wrap">
                  <select
                    className="field-input field-select"
                    value={formData.lineId}
                    onChange={handleFormChange('lineId')}
                  >
                    <option value="">— Selecciona una línea —</option>
                    {lines.map((line) => (
                      <option key={line.research_line_id} value={line.research_line_id}>
                        {line.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="select-chevron" />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Sublínea</label>
                <div className="select-wrap">
                  <select
                    className="field-input field-select"
                    value={formData.sublineId}
                    onChange={handleFormChange('sublineId')}
                    disabled={!formData.lineId}
                  >
                    <option value="">— Selecciona una sublínea —</option>
                    {filteredSublines.map((subline) => (
                      <option
                        key={subline.research_subline_id}
                        value={subline.research_subline_id}
                      >
                        {subline.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="select-chevron" />
                </div>
              </div>
              <div className="field form-span">
                <label className="field-label">Enlace de carta de presentación</label>
                <input
                  type="url"
                  value={formData.letterLink}
                  onChange={handleFormChange('letterLink')}
                  className="field-input"
                  placeholder="https://drive.google.com/..."
                />
              </div>

              <div className="field form-span">
                <label className="field-label">Co-autores del proyecto (opcional)</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="email"
                    value={newCoauthorEmail}
                    onChange={(e) => { setNewCoauthorEmail(e.target.value); setFormError(''); }}
                    className="field-input"
                    placeholder="Correo del compañero (ej: juan@cesmag.edu.co)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        verifyAndAddAuthor();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    loading={verifyingCoauthor}
                    onClick={verifyAndAddAuthor}
                  >
                    Verificar y Agregar
                  </Button>
                </div>
                {formData.coauthors.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {formData.coauthors.map(c => (
                      <div key={c.id} style={{ 
                        display: 'flex', alignItems: 'center', gap: '6px', 
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                        padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem' 
                      }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>({c.email})</span>
                        <button 
                          type="button" 
                          onClick={() => removeCoauthor(c.id)} 
                          style={{ 
                            background: 'transparent', border: 'none', color: 'var(--text-muted)', 
                            cursor: 'pointer', padding: '0 4px', fontSize: '1.2rem', lineHeight: 1 
                          }}
                          title="Remover co-autor"
                        >&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-actions">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={handleCloseForm}
                >
                  Cancelar
                </Button>
                <Button variant="primary" type="submit" loading={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar proyecto'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {isDocente && (
          <div className="docente-role-tabs">
            {[
              { key: 'all',    label: 'Todos mis proyectos' },
              { key: 'asesor', label: 'Como asesor' },
              { key: 'jurado', label: 'Como jurado' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`docente-role-tab${filters.docenteRole === tab.key ? ' active' : ''}`}
                onClick={() => setFilters(f => ({ ...f, docenteRole: tab.key }))}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="filters-card">
          <div className="filters-header">
            <div className="filters-title">
              <Filter size={16} />
              <span>Filtros de busqueda</span>
            </div>
            <span className="filters-count">
              {filteredProjects.length} resultados
            </span>
          </div>
          <div className="filters-grid">
            <div className="field">
              <label className="field-label">Buscar</label>
              <input
                type="text"
                value={filters.search}
                onChange={handleFilterChange('search')}
                placeholder="Codigo o titulo"
                className="field-input"
              />
            </div>
            <div className="field">
              <label className="field-label">Estado</label>
              <div className="select-wrap">
                <select
                  className="field-input field-select"
                  value={filters.status}
                  onChange={handleFilterChange('status')}
                >
                  <option value="all">Todos los estados</option>
                  {statuses.map((status) => (
                    <option key={status.status_id} value={status.name}>
                      {status.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Modalidad</label>
              <div className="select-wrap">
                <select
                  className="field-input field-select"
                  value={filters.modality}
                  onChange={handleFilterChange('modality')}
                >
                  <option value="all">Todas las modalidades</option>
                  {modalities.map((modality) => (
                    <option key={modality.modality_id} value={modality.name}>
                      {modality.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Año</label>
              <div className="select-wrap">
                <select
                  className="field-input field-select"
                  value={filters.year}
                  onChange={handleFilterChange('year')}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year === 'all' ? 'Todos los años' : year}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>
          </div>
        </div>

        {/* ── TABLA COMPLETA ──────────────────────────────────── */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Título / Línea</th>
                <th>Estado</th>
                <th>Modalidad</th>
                <th>Autores</th>
                <th>Año</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="table-empty">Cargando proyectos...</td></tr>
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <tr key={project.id} className="table-row">
                    <td className="table-title" data-label="Código">{project.code}</td>
                    <td data-label="Título / Línea">
                      <div className="project-title">{project.title}</div>
                      <span className="project-meta">{project.line}</span>
                    </td>
                    <td data-label="Estado"><span className="badge">{project.status}</span></td>
                    <td data-label="Modalidad">{project.modality}</td>
                    <td className="project-meta" data-label="Autores">
                      {project.authorsArray.map((author, i) => (
                        <div key={i} style={{ marginBottom: '2px', whiteSpace: 'nowrap' }}>{author}</div>
                      ))}
                    </td>
                    <td data-label="Año">{project.year}</td>
                    <td data-label="Acciones">
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailModal(project)}
                        >
                          Ver
                        </Button>
                        {!isLimitedUser && (
                          <Button variant="ghost" size="sm" onClick={() => setEditModal(project)}>Editar</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="7" className="table-empty">No hay proyectos que coincidan con los filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── MODAL DETALLE ───────────────────────────────────── */}
        {detailModal && (
          <div className="modal-backdrop" onClick={() => setDetailModal(null)}>
            <div className="modal-box modal-box--lg" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-header-text">
                  <span className="modal-eyebrow">Ficha del proyecto</span>
                  <h2 className="modal-title">{detailModal.title}</h2>
                  <span className="modal-code">{detailModal.code}</span>
                </div>
                <button className="modal-close" type="button" onClick={() => setDetailModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="modal-badges">
                  <span className="badge">{detailModal.status}</span>
                  <span className="badge badge--muted">{detailModal.modality}</span>
                  {detailModal.isOwned && <span className="badge badge--owned">Mi proyecto</span>}
                </div>

                <div className="modal-info-grid">
                  <div className="modal-info-item">
                    <span className="modal-info-key">Línea de investigación</span>
                    <span className="modal-info-val">{detailModal.line || '—'}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-key">Sublínea</span>
                    <span className="modal-info-val">{detailModal.subline || '—'}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-key">Autores</span>
                    <span className="modal-info-val">
                      {detailModal.authorsArray?.map((author, i) => (
                        <div key={i} style={{ marginBottom: '4px' }}>{author}</div>
                      )) || '—'}
                    </span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-key">Docente asesor</span>
                    <span className="modal-info-val">{detailModal.advisor}</span>
                  </div>
                  {!isStudent && (
                    <div className="modal-info-item">
                      <span className="modal-info-key">Jurados</span>
                      <span className="modal-info-val">{detailModal.jurados}</span>
                    </div>
                  )}
                  <div className="modal-info-item">
                    <span className="modal-info-key">Año de registro</span>
                    <span className="modal-info-val">{detailModal.year}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-key">Última actualización</span>
                    <span className="modal-info-val">
                      {detailModal.updatedAt
                        ? new Date(detailModal.updatedAt).toLocaleDateString('es-CO')
                        : '—'}
                    </span>
                  </div>
                </div>

                {detailModal.description?.startsWith('Carta:') && (
                  <div className="modal-link-row">
                    <span className="modal-info-key">Carta de presentación</span>
                    <a
                      href={detailModal.description.replace('Carta: ', '')}
                      target="_blank"
                      rel="noreferrer"
                      className="modal-link"
                    >
                      <ExternalLink size={13} /> Ver carta
                    </a>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                {!isStudent && (
                  <Button variant="primary" icon={Download} onClick={() => window.print()}>
                    Exportar a PDF
                  </Button>
                )}
                {!isLimitedUser && (
                  <Button variant="ghost" icon={Pencil} onClick={() => { setDetailModal(null); setEditModal(detailModal); }}>Editar</Button>
                )}
                {!isStudent && (
                  <Button variant="ghost" icon={History} onClick={() => {
                    const p = detailModal;
                    setDetailModal(null);
                    setHistoryModal(p);
                    fetchHistory(p.id);
                  }}>
                    Historial
                  </Button>
                )}
                <button className="modal-close-btn" type="button" onClick={() => setDetailModal(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL HISTORIAL ─────────────────────────────────── */}
        {historyModal && (
          <div className="modal-backdrop" onClick={() => setHistoryModal(null)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-header-text">
                  <span className="modal-eyebrow">Historial de cambios</span>
                  <h2 className="modal-title">{historyModal.title}</h2>
                </div>
                <button className="modal-close" type="button" onClick={() => setHistoryModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                {historyLoading ? (
                  <div className="history-empty">Cargando historial...</div>
                ) : historyItems.length > 0 ? (
                  <div className="history-timeline">
                    {historyItems.map((item) => (
                      <div key={item.id} className="timeline-item">
                        <div className="timeline-dot" />
                        <div className="timeline-content">
                          <div className="timeline-title">{item.title}</div>
                          <div className="timeline-detail">{item.detail}</div>
                          <span className="timeline-date">{item.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="history-empty">
                    <History size={36} style={{ opacity: 0.25, marginBottom: 10 }} />
                    <p>No hay registros de cambios para este proyecto.</p>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="modal-close-btn" type="button" onClick={() => setHistoryModal(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {editModal && (
        <EditProjectModal
          project={editModal}
          statuses={statuses}
          modalities={modalities}
          lines={lines}
          sublines={sublines}
          user={user}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); loadData(); }}
        />
        )}
      </div>


      {showCrearModal && (
        <CrearProyecto
          statuses={statuses}
          modalities={modalities}
          lines={lines}
          sublines={sublines}
          user={user}
          onClose={() => setShowCrearModal(false)}
          onSaved={() => { setShowCrearModal(false); loadData(); }}
        />
      )}
    </DashboardLayout>
  );
}
