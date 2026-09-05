import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FilePlus,
  Filter,
  GraduationCap,
  Layers,
  Pencil,
  Power,
  RotateCcw,
  Search,
  Tag,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import api from '../../lib/api';
import './BancoProyectos.css';

export default function BancoProyectos() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Role detection
  const normalizedRole = user?.role?.toLowerCase() || '';
  const isAdmin = ['admin', 'administrador'].includes(normalizedRole) || user?.authMode === 'local';
  const isDocente = ['docente', 'profesor'].includes(normalizedRole);
  const isStudent = !isAdmin && !isDocente; // defaults to student if not admin or teacher

  const currentUserId = String(user?.user_id || user?.id || '');
  const userProgramId = user?.programId ? String(user.programId) : null;

  // State
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Catalogs
  const [catalogs, setCatalogs] = useState({ programs: [], lines: [], sublines: [] });
  const [studentAssignedProject, setStudentAssignedProject] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    lineId: 'all',
    sublineId: 'all',
    programId: userProgramId || 'all',
    year: 'all',
    proposerRole: 'all',
  });

  // Modals state
  const [detailModal, setDetailModal] = useState(null);
  const [projectHistory, setProjectHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [confirmSelectModal, setConfirmSelectModal] = useState(null);
  const [createEditModal, setCreateEditModal] = useState({
    isOpen: false,
    mode: 'create', // 'create' | 'edit'
    project: null,
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    generalObjective: '',
    specificObjectives: '',
    researchLineId: '',
    researchSublineId: '',
    programId: '',
    keywords: '',
    observations: '',
  });

  // Fetch all catalogs and projects
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch catalogs
      const catData = await api.getCatalogs().catch(() => ({ programs: [], lines: [], sublines: [] }));
      const allLines = catData.lines || [];
      const progLines = userProgramId
        ? allLines.filter(l => !l.program_id || String(l.program_id) === String(userProgramId))
        : allLines;
      const allSublines = catData.sublines || [];
      const progSublines = userProgramId
        ? allSublines.filter(sl => progLines.some(l => l.research_line_id === sl.research_line_id))
        : allSublines;

      setCatalogs({
        programs: catData.programs || [],
        lines: progLines,
        sublines: progSublines,
      });

      // 2. Fetch project bank ideas with strict SQL-level program isolation
      const queryFilters = userProgramId ? { programId: userProgramId } : {};
      const bankData = await api.getProjectBank(queryFilters, currentUserId);
      setProjects(bankData || []);

      // 3. If student, check if they already have an assigned project
      if (isStudent && currentUserId) {
        const studentCheck = await api.getStudentAssignedProject(currentUserId).catch(() => ({ hasAssignedProject: false }));
        if (studentCheck?.hasAssignedProject && studentCheck?.project) {
          setStudentAssignedProject(studentCheck.project);
        } else {
          setStudentAssignedProject(null);
        }
      }
    } catch (err) {
      console.error('Error al cargar banco de proyectos:', err);
      setError('Error al cargar las ideas de proyecto. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [isStudent, currentUserId, userProgramId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load history when detailModal opens
  useEffect(() => {
    if (!detailModal?.project_bank_id) {
      setProjectHistory([]);
      return;
    }
    let isMounted = true;
    setLoadingHistory(true);
    setHistoryError('');
    api.getProjectBankHistory(detailModal.project_bank_id, currentUserId)
      .then((hist) => {
        if (isMounted) setProjectHistory(Array.isArray(hist) ? hist : []);
      })
      .catch((err) => {
        if (isMounted) setHistoryError(err.message || 'No se pudo cargar el historial');
      })
      .finally(() => {
        if (isMounted) setLoadingHistory(false);
      });
    return () => {
      isMounted = false;
    };
  }, [detailModal?.project_bank_id, currentUserId]);

  // Sublines filtered by selected line in filters
  const filteredFilterSublines = useMemo(() => {
    if (!filters.lineId || filters.lineId === 'all') return catalogs.sublines;
    return catalogs.sublines.filter(sl => String(sl.research_line_id) === String(filters.lineId));
  }, [filters.lineId, catalogs.sublines]);

  // Sublines filtered by line in form
  const filteredFormSublines = useMemo(() => {
    if (!formData.researchLineId) return catalogs.sublines;
    return catalogs.sublines.filter(sl => String(sl.research_line_id) === String(formData.researchLineId));
  }, [formData.researchLineId, catalogs.sublines]);

  // Unique years for filter
  const availableYears = useMemo(() => {
    const setYears = new Set();
    projects.forEach(p => {
      if (p.year) setYears.add(String(p.year));
      else if (p.created_at) {
        const y = new Date(p.created_at).getFullYear();
        if (y) setYears.add(String(y));
      }
    });
    return Array.from(setYears).sort((a, b) => b.localeCompare(a));
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Search
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        const matchesTitle = p.title?.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        const matchesKey = p.keywords?.toLowerCase().includes(q);
        const matchesProposer = p.proposer_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesKey && !matchesProposer) return false;
      }

      // Status
      if (filters.status !== 'all') {
        if (p.status?.toLowerCase() !== filters.status.toLowerCase()) return false;
      }

      // Program isolation
      if (userProgramId) {
        if (String(p.program_id) !== String(userProgramId)) return false;
      }

      // Line
      if (filters.lineId !== 'all') {
        if (String(p.research_line_id) !== String(filters.lineId)) return false;
      }

      // Subline
      if (filters.sublineId !== 'all') {
        if (String(p.research_subline_id) !== String(filters.sublineId)) return false;
      }

      // Program filter (for users with multi-program access)
      if (filters.programId !== 'all') {
        if (String(p.program_id) !== String(filters.programId)) return false;
      }

      // Year
      if (filters.year !== 'all') {
        const pYear = p.year ? String(p.year) : (p.created_at ? String(new Date(p.created_at).getFullYear()) : '');
        if (pYear !== String(filters.year)) return false;
      }

      // Proposer Role
      if (filters.proposerRole !== 'all') {
        if (p.proposer_role?.toLowerCase() !== filters.proposerRole.toLowerCase()) return false;
      }

      return true;
    });
  }, [projects, filters, userProgramId]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      if (key === 'lineId') {
        updated.sublineId = 'all'; // reset subline when line changes
      }
      return updated;
    });
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      lineId: 'all',
      sublineId: 'all',
      programId: userProgramId || 'all',
      year: 'all',
      proposerRole: 'all',
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'search') return v.trim() !== '';
    if (k === 'programId') return userProgramId ? v !== userProgramId : v !== 'all';
    return v !== 'all';
  });

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      title: '',
      description: '',
      generalObjective: '',
      specificObjectives: '',
      researchLineId: '',
      researchSublineId: '',
      programId: user?.programId ? String(user.programId) : '',
      keywords: '',
      observations: '',
    });
    setFormError('');
    setCreateEditModal({ isOpen: true, mode: 'create', project: null });
  };

  // Open Edit Modal
  const handleOpenEditModal = (project) => {
    setFormData({
      title: project.title || '',
      description: project.description || '',
      generalObjective: project.general_objective || '',
      specificObjectives: project.specific_objectives || '',
      researchLineId: project.research_line_id ? String(project.research_line_id) : '',
      researchSublineId: project.research_subline_id ? String(project.research_subline_id) : '',
      programId: project.program_id ? String(project.program_id) : '',
      keywords: project.keywords || '',
      observations: project.observations || '',
    });
    setFormError('');
    setCreateEditModal({ isOpen: true, mode: 'edit', project });
  };

  // Submit Create or Edit
  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      setFormError('El título y la descripción son obligatorios.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      const payload = {
        ...formData,
        userId: currentUserId,
        userRole: user?.role || (isAdmin ? 'Administrador' : 'Docente'),
      };

      if (createEditModal.mode === 'create') {
        await api.createProjectBankIdea(payload);
        setSuccessToast('Idea de proyecto registrada exitosamente en el banco.');
      } else {
        await api.updateProjectBankIdea(createEditModal.project.project_bank_id, payload);
        setSuccessToast('Idea de proyecto actualizada correctamente.');
      }

      setCreateEditModal({ isOpen: false, mode: 'create', project: null });
      await loadData();
    } catch (err) {
      console.error('Error al guardar idea:', err);
      setFormError(err.message || 'Error al guardar la idea de proyecto.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Project Status (Desactivar / Reactivar)
  const handleToggleStatus = async (project) => {
    const newStatus = project.status === 'Disponible' ? 'Inactivo' : 'Disponible';
    const actionLabel = newStatus === 'Inactivo' ? 'desactivar' : 'reactivar';
    const confirmMessage = `¿Estás seguro de que deseas ${actionLabel} el proyecto "${project.title}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await api.toggleProjectBankStatus(project.project_bank_id, newStatus, user?.role || 'Administrador', currentUserId);
      setSuccessToast(`Proyecto ${newStatus === 'Inactivo' ? 'desactivado' : 'reactivado'} correctamente.`);
      await loadData();
    } catch (err) {
      alert(err.message || 'Error al actualizar estado del proyecto.');
    }
  };

  // Open Select Confirmation
  const handlePromptSelectProject = (project) => {
    setConfirmSelectModal(project);
  };

  // Confirm Selection by Student
  const handleConfirmSelection = async () => {
    if (!confirmSelectModal) return;
    setFormSubmitting(true);

    try {
      await api.selectProjectBankIdea(confirmSelectModal.project_bank_id, currentUserId);
      setSuccessToast('¡Proyecto seleccionado correctamente! Ahora se encuentra registrado en tu perfil.');
      setConfirmSelectModal(null);
      setDetailModal(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'No fue posible seleccionar el proyecto.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Permissions helper
  const canEditProject = (project) => {
    if (isAdmin) return true;
    if (isDocente && String(project.proposer_id) === String(currentUserId)) return true;
    return false;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No registrada';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'No registrada';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <DashboardLayout
      title="Banco de Proyectos"
      subtitle="Explora, gestiona y selecciona ideas para proyectos de grado."
    >
      <div className="banco-page">

        {/* TOAST SUCCESS NOTIFICATION */}
        {successToast && (
          <div className="banco-toast-success">
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{successToast}</span>
            <button
              onClick={() => setSuccessToast('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* STUDENT ALREADY HAS PROJECT NOTICE */}
        {isStudent && studentAssignedProject && (
          <div className="student-notice-banner">
            <div className="student-notice-content">
              <div className="student-notice-icon">
                <GraduationCap size={22} />
              </div>
              <div>
                <div className="student-notice-title">Ya tienes un proyecto de grado asignado</div>
                <p className="student-notice-desc">
                  Has seleccionado: <strong>{studentAssignedProject.title}</strong>. Recuerda que cada estudiante puede seleccionar únicamente un proyecto.
                </p>
              </div>
            </div>
            <div className="student-notice-action">
              <Button
                variant="primary"
                icon={Eye}
                onClick={() => navigate('/ajustes#mi-proyecto-de-grado')}
              >
                Ver mi proyecto
              </Button>
            </div>
          </div>
        )}

        {/* TOP HERO */}
        <div className="banco-hero">
          <div className="banco-hero-copy">
            <div className="banco-eyebrow">
              <BookOpen size={14} />
              <span>Catálogo Institucional</span>
            </div>
            <h1 className="banco-title">Banco de Proyectos</h1>
            <p className="banco-subtitle">
              Explora, gestiona y selecciona ideas para proyectos de grado.
            </p>
          </div>

          {(isAdmin || isDocente) && (
            <div className="banco-hero-actions">
              <Button
                variant="primary"
                icon={FilePlus}
                onClick={handleOpenCreateModal}
              >
                + Nueva idea de proyecto
              </Button>
            </div>
          )}
        </div>

        {/* SEARCH & FILTERS CARD */}
        <div className="banco-filters-card">
          <div className="banco-filters-header">
            <div className="banco-filters-title">
              <Filter size={15} />
              <span>Búsqueda y Filtros</span>
            </div>
            <div className="banco-filters-meta">
              <span className="banco-filters-count">{filteredProjects.length} proyecto(s)</span>
              {hasActiveFilters && (
                <button className="banco-filters-clear" onClick={handleClearFilters}>
                  <X size={13} /> Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <div className="banco-filters-grid">
            {/* Search Input */}
            <div className="banco-field" style={{ gridColumn: 'span 1' }}>
              <label className="banco-field-label">Buscar</label>
              <div className="banco-search-wrap">
                <Search size={15} className="banco-search-icon" />
                <input
                  type="text"
                  className="banco-input banco-search-input"
                  placeholder="Título, palabra clave, proponente..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="banco-field">
              <label className="banco-field-label">Estado</label>
              <div className="banco-select-wrap">
                <select
                  className="banco-select"
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="Disponible">Disponible</option>
                  <option value="Asignado">Asignado</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
                <ChevronDown size={14} className="banco-select-chevron" />
              </div>
            </div>

            {/* Research Line Filter */}
            <div className="banco-field">
              <label className="banco-field-label">Línea de investigación</label>
              <div className="banco-select-wrap">
                <select
                  className="banco-select"
                  value={filters.lineId}
                  onChange={(e) => handleFilterChange('lineId', e.target.value)}
                >
                  <option value="all">Todas las líneas</option>
                  {catalogs.lines.map((l) => (
                    <option key={l.research_line_id} value={l.research_line_id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="banco-select-chevron" />
              </div>
            </div>

            {/* Subline Filter */}
            <div className="banco-field">
              <label className="banco-field-label">Sublínea</label>
              <div className="banco-select-wrap">
                <select
                  className="banco-select"
                  value={filters.sublineId}
                  onChange={(e) => handleFilterChange('sublineId', e.target.value)}
                >
                  <option value="all">Todas las sublíneas</option>
                  {filteredFilterSublines.map((sl) => (
                    <option key={sl.research_subline_id} value={sl.research_subline_id}>
                      {sl.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="banco-select-chevron" />
              </div>
            </div>

            {/* Program Filter */}
            <div className="banco-field">
              <label className="banco-field-label">
                Programa académico {userProgramId && <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', textTransform: 'none' }}>(Tu programa)</span>}
              </label>
              <div className="banco-select-wrap">
                <select
                  className="banco-select"
                  value={userProgramId || filters.programId}
                  onChange={(e) => !userProgramId && handleFilterChange('programId', e.target.value)}
                  disabled={Boolean(userProgramId)}
                  title={userProgramId ? 'Filtrado exclusivamente a tu programa académico asignado' : 'Filtrar por programa'}
                >
                  {!userProgramId && <option value="all">Todos los programas</option>}
                  {catalogs.programs.map((pr) => (
                    <option key={pr.program_id} value={pr.program_id}>
                      {pr.name} {userProgramId && String(pr.program_id) === String(userProgramId) ? ' (Tu programa)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="banco-select-chevron" />
              </div>
            </div>

            {/* Year Filter */}
            <div className="banco-field">
              <label className="banco-field-label">Año</label>
              <div className="banco-select-wrap">
                <select
                  className="banco-select"
                  value={filters.year}
                  onChange={(e) => handleFilterChange('year', e.target.value)}
                >
                  <option value="all">Todos los años</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="banco-select-chevron" />
              </div>
            </div>

            {/* Proposer Type Filter */}
            <div className="banco-field">
              <label className="banco-field-label">Proponente</label>
              <div className="banco-select-wrap">
                <select
                  className="banco-select"
                  value={filters.proposerRole}
                  onChange={(e) => handleFilterChange('proposerRole', e.target.value)}
                >
                  <option value="all">Todos los proponentes</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Docente">Docente</option>
                </select>
                <ChevronDown size={14} className="banco-select-chevron" />
              </div>
            </div>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="ax-error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* LOADING STATE */}
        {loading ? (
          <div className="ax-loading">
            <div className="ax-spinner" />
            <p>Cargando Banco de Proyectos...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          /* EMPTY STATE */
          <div className="banco-empty-state">
            <BookOpen size={48} className="banco-empty-icon" />
            <h3 className="banco-empty-title">No se encontraron ideas de proyecto</h3>
            <p className="banco-empty-desc">
              {hasActiveFilters
                ? 'No hay ideas de proyecto que coincidan con los filtros aplicados. Intenta restablecer los filtros para ver más resultados.'
                : 'Aún no se han registrado ideas de proyecto en el banco. Los docentes y administradores pueden proponer ideas utilizando el botón superior.'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          /* CARDS GRID */
          <div className="banco-cards-grid">
            {filteredProjects.map((p) => {
              const isAvailable = p.status === 'Disponible';
              const isAssigned = p.status === 'Asignado';
              const isInactive = p.status === 'Inactivo';

              const proposerTypeLabel =
                p.proposer_role?.toLowerCase() === 'docente'
                  ? 'Propuesto por docente'
                  : 'Propuesto por administrador';

              return (
                <div
                  key={p.project_bank_id}
                  className={`banco-card ${isInactive ? 'banco-card--inactive' : ''}`}
                >
                  {/* Top Badges */}
                  <div className="banco-card-header">
                    <div className="banco-card-badges-top">
                      <span className={`banco-badge-status banco-badge-status--${p.status?.toLowerCase()}`}>
                        {isAvailable && <CheckCircle2 size={11} />}
                        {isAssigned && <UserCheck size={11} />}
                        {isInactive && <Power size={11} />}
                        {p.status}
                      </span>
                      <span className="banco-badge-proposer">{proposerTypeLabel}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="banco-card-title" title={p.title}>
                    {p.title}
                  </h3>

                  {/* Description */}
                  <p className="banco-card-desc">
                    {p.description}
                  </p>

                  {/* Metadata List */}
                  <div className="banco-card-meta-list">
                    <div className="banco-card-meta-item">
                      <Layers size={14} className="banco-card-meta-icon" />
                      <span><strong>Línea:</strong> {p.line_name || 'Sin línea'}</span>
                    </div>
                    {p.subline_name && (
                      <div className="banco-card-meta-item">
                        <Tag size={14} className="banco-card-meta-icon" />
                        <span><strong>Sublínea:</strong> {p.subline_name}</span>
                      </div>
                    )}
                    <div className="banco-card-meta-item">
                      <GraduationCap size={14} className="banco-card-meta-icon" />
                      <span><strong>Programa:</strong> {p.program_name || 'General'}</span>
                    </div>
                    <div className="banco-card-meta-item">
                      <User size={14} className="banco-card-meta-icon" />
                      <span><strong>Proponente:</strong> {p.proposer_name || 'No especificado'}</span>
                    </div>
                    <div className="banco-card-meta-item">
                      <Calendar size={14} className="banco-card-meta-icon" />
                      <span><strong>Registro:</strong> {formatDate(p.created_at)}</span>
                    </div>
                  </div>

                  {/* Assigned info pill if assigned */}
                  {isAssigned && p.assigned_student_name && (
                    <div className="banco-card-assigned-pill">
                      <UserCheck size={14} style={{ flexShrink: 0, color: 'var(--accent-primary)' }} />
                      <span>
                        Asignado a: <strong>{p.assigned_student_name}</strong> {p.assigned_at ? `(${formatDate(p.assigned_at)})` : ''}
                      </span>
                    </div>
                  )}

                  {/* Card Actions Depending on Role */}
                  <div className="banco-card-actions">
                    {/* Ver detalle (visible for all) */}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Eye}
                      onClick={() => setDetailModal(p)}
                    >
                      Ver detalle
                    </Button>

                    {/* ADMINISTRATOR ACTIONS */}
                    {isAdmin && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Pencil}
                          onClick={() => handleOpenEditModal(p)}
                        >
                          Editar
                        </Button>
                        {isAvailable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Power}
                            onClick={() => handleToggleStatus(p)}
                            title="Desactivar proyecto"
                          >
                            Desactivar
                          </Button>
                        )}
                        {isInactive && (
                          <Button
                            variant="outline"
                            size="sm"
                            icon={RotateCcw}
                            onClick={() => handleToggleStatus(p)}
                            title="Reactivar proyecto"
                          >
                            Reactivar
                          </Button>
                        )}
                      </>
                    )}

                    {/* DOCENTE ACTIONS */}
                    {isDocente && canEditProject(p) && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Pencil}
                        onClick={() => handleOpenEditModal(p)}
                      >
                        Editar
                      </Button>
                    )}

                    {/* ESTUDIANTE ACTIONS */}
                    {isStudent && (
                      <>
                        {isAvailable && (
                          !studentAssignedProject ? (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={CheckCircle2}
                              onClick={() => handlePromptSelectProject(p)}
                            >
                              Escoger proyecto
                            </Button>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              Disponible
                            </span>
                          )
                        )}

                        {isAssigned && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                            Proyecto asignado
                          </span>
                        )}

                        {isInactive && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            No disponible
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ── MODAL DETALLE DE PROYECTO ────────────────────────────────────────── */}
      {detailModal && (
        <div className="banco-modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="banco-modal banco-modal--large" onClick={(e) => e.stopPropagation()}>
            <div className="banco-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} color="var(--accent-primary)" />
                <h2 className="banco-modal-title">Detalle de la Idea de Proyecto</h2>
              </div>
              <button className="banco-modal-close" onClick={() => setDetailModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="banco-modal-body">
              {/* Status and Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 4 }}>
                <span className={`banco-badge-status banco-badge-status--${detailModal.status?.toLowerCase()}`}>
                  {detailModal.status}
                </span>
                <span className="banco-badge-proposer">
                  {detailModal.proposer_role?.toLowerCase() === 'docente' ? 'Propuesto por docente' : 'Propuesto por administrador'}
                </span>
              </div>

              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: 0, color: 'var(--text-primary)' }}>
                {detailModal.title}
              </h2>

              {/* Assignment Info if Assigned */}
              {detailModal.status === 'Asignado' && detailModal.assigned_student_name && (
                <div className="banco-assignment-box">
                  <div className="banco-assignment-box-title">
                    <UserCheck size={16} />
                    <span>Información de Asignación</span>
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                    Estudiante asignado: <strong>{detailModal.assigned_student_name}</strong> ({detailModal.assigned_student_email || 'Sin correo'})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Fecha de asignación: {formatDate(detailModal.assigned_at)}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="banco-detail-section">
                <span className="banco-detail-label">Descripción completa</span>
                <p className="banco-detail-text">{detailModal.description}</p>
              </div>

              {/* General Objective */}
              {detailModal.general_objective && (
                <div className="banco-detail-section">
                  <span className="banco-detail-label">Objetivo general</span>
                  <p className="banco-detail-text">{detailModal.general_objective}</p>
                </div>
              )}

              {/* Specific Objectives */}
              {detailModal.specific_objectives && (
                <div className="banco-detail-section">
                  <span className="banco-detail-label">Objetivos específicos</span>
                  <p className="banco-detail-text">{detailModal.specific_objectives}</p>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="banco-detail-grid">
                <div className="banco-detail-grid-item">
                  <span>Línea de investigación</span>
                  <span>{detailModal.line_name || 'No especificada'}</span>
                </div>
                <div className="banco-detail-grid-item">
                  <span>Sublínea</span>
                  <span>{detailModal.subline_name || 'No especificada'}</span>
                </div>
                <div className="banco-detail-grid-item">
                  <span>Programa académico</span>
                  <span>{detailModal.program_name || 'General'}</span>
                </div>
                <div className="banco-detail-grid-item">
                  <span>Proponente</span>
                  <span>{detailModal.proposer_name} ({detailModal.proposer_role})</span>
                </div>
                <div className="banco-detail-grid-item">
                  <span>Fecha de creación</span>
                  <span>{formatDate(detailModal.created_at)}</span>
                </div>
                <div className="banco-detail-grid-item">
                  <span>Estado actual</span>
                  <span>{detailModal.status}</span>
                </div>
              </div>

              {/* Keywords */}
              {detailModal.keywords && (
                <div className="banco-detail-section">
                  <span className="banco-detail-label">Palabras clave</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {detailModal.keywords.split(',').map((kw, i) => (
                      <span
                        key={i}
                        style={{
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        #{kw.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Observations */}
              {detailModal.observations && (
                <div className="banco-detail-section">
                  <span className="banco-detail-label">Observaciones</span>
                  <p className="banco-detail-text" style={{ fontStyle: 'italic' }}>
                    {detailModal.observations}
                  </p>
                </div>
              )}

              {/* HISTORIAL DE TRAZABILIDAD */}
              <div className="banco-detail-section" style={{ marginTop: '12px' }}>
                <span className="banco-detail-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> {(isStudent || isDocente) ? 'Historial de Cambios (Propios y de Administración)' : 'Historial y Trazabilidad de Cambios'}
                </span>
                {loadingHistory ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '12px 0' }}>
                    Cargando historial de cambios...
                  </div>
                ) : historyError ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--accent-danger)', padding: '8px 0' }}>
                    {historyError}
                  </div>
                ) : projectHistory.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                    {(isStudent || isDocente)
                      ? 'No hay registros de cambios realizados por ti o por el administrador para este proyecto.'
                      : 'No hay registros de historial para este proyecto.'}
                  </div>
                ) : (
                  <div className="banco-history-timeline">
                    {projectHistory.map((item) => {
                      const actionType = (item.action || '').toUpperCase();
                      let badgeClass = 'banco-history-action--create';
                      let badgeText = actionType;
                      if (actionType === 'UPDATE') {
                        badgeClass = 'banco-history-action--update';
                        badgeText = 'Edición';
                      } else if (actionType === 'SELECT') {
                        badgeClass = 'banco-history-action--select';
                        badgeText = 'Selección';
                      } else if (actionType === 'DEACTIVATE') {
                        badgeClass = 'banco-history-action--deactivate';
                        badgeText = 'Desactivación';
                      } else if (actionType === 'REACTIVATE') {
                        badgeClass = 'banco-history-action--reactivate';
                        badgeText = 'Reactivación';
                      } else if (actionType === 'CREATE') {
                        badgeText = 'Creación';
                      }

                      const changesObj = typeof item.changes === 'object' && item.changes !== null ? item.changes : null;
                      const hasStructuredDiffs = changesObj && Object.keys(changesObj).some(k => changesObj[k] && typeof changesObj[k] === 'object' && 'before' in changesObj[k] && 'after' in changesObj[k]);

                      return (
                        <div key={item.project_bank_history_id} className="banco-history-card">
                          <div className="banco-history-header">
                            <div className="banco-history-user-info">
                              <strong>{item.user_name || 'Sistema'}</strong>
                              <span className="banco-history-role">({item.user_role || 'Usuario'})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`banco-history-action-badge ${badgeClass}`}>
                                {badgeText}
                              </span>
                              <span className="banco-history-date">
                                {formatDateTime(item.created_at)}
                              </span>
                            </div>
                          </div>

                          {(item.previous_status || item.new_status) && item.previous_status !== item.new_status && (
                            <div className="banco-history-status-transition">
                              Estado: <strong>{item.previous_status || '—'}</strong> → <strong style={{ color: 'var(--accent-primary)' }}>{item.new_status}</strong>
                            </div>
                          )}

                          {hasStructuredDiffs && (
                            <div className="banco-history-diff-list">
                              {Object.entries(changesObj).map(([key, diff]) => {
                                if (!diff || typeof diff !== 'object' || !('before' in diff) || !('after' in diff)) return null;
                                return (
                                  <div key={key} className="banco-history-diff-item">
                                    <span className="banco-history-diff-label">{diff.label || key}:</span>
                                    <span className="banco-history-diff-val">
                                      <del>{diff.before || '(vacío)'}</del> → <ins>{diff.after || '(vacío)'}</ins>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {changesObj && changesObj.event && !hasStructuredDiffs && (
                            <div className="banco-history-note">
                              {changesObj.event}
                              {changesObj.student_name ? ` por ${changesObj.student_name}` : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="banco-modal-footer">
              <Button variant="ghost" onClick={() => setDetailModal(null)}>
                Cerrar
              </Button>

              {/* If student and project is available and student has no project */}
              {isStudent && detailModal.status === 'Disponible' && !studentAssignedProject && (
                <Button
                  variant="primary"
                  icon={CheckCircle2}
                  onClick={() => {
                    handlePromptSelectProject(detailModal);
                  }}
                >
                  Escoger este proyecto
                </Button>
              )}

              {/* If student and already has assigned project */}
              {isStudent && detailModal.status === 'Disponible' && studentAssignedProject && (
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Ya cuentas con un proyecto asignado
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR SELECCIÓN DE PROYECTO ───────────────────────────── */}
      {confirmSelectModal && (
        <div className="banco-modal-overlay" onClick={() => !formSubmitting && setConfirmSelectModal(null)}>
          <div className="banco-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="banco-modal-header">
              <h3 className="banco-modal-title">Confirmar Selección de Proyecto</h3>
              <button
                className="banco-modal-close"
                disabled={formSubmitting}
                onClick={() => setConfirmSelectModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="banco-modal-body">
              <div className="banco-confirm-dialog">
                <div className="banco-confirm-icon">
                  <Award size={26} />
                </div>
                <h4 className="banco-confirm-title">{confirmSelectModal.title}</h4>
                <p className="banco-confirm-desc">
                  ¿Estás seguro de que deseas escoger este proyecto? Recuerda que solo puedes seleccionar un proyecto de grado.
                </p>
                <div className="banco-confirm-warning">
                  ⚠️ Una vez confirmada tu selección, el proyecto quedará asignado a tu nombre y no podrás seleccionar otra propuesta.
                </div>
              </div>
            </div>

            <div className="banco-modal-footer">
              <Button
                variant="ghost"
                disabled={formSubmitting}
                onClick={() => setConfirmSelectModal(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                loading={formSubmitting}
                icon={CheckCircle2}
                onClick={handleConfirmSelection}
              >
                Confirmar selección
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CREAR / EDITAR IDEA DE PROYECTO ────────────────────────────── */}
      {createEditModal.isOpen && (
        <div className="banco-modal-overlay" onClick={() => !formSubmitting && setCreateEditModal({ isOpen: false, mode: 'create', project: null })}>
          <div className="banco-modal banco-modal--large" onClick={(e) => e.stopPropagation()}>
            <div className="banco-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FilePlus size={20} color="var(--accent-primary)" />
                <h2 className="banco-modal-title">
                  {createEditModal.mode === 'create' ? 'Nueva Idea de Proyecto' : 'Editar Idea de Proyecto'}
                </h2>
              </div>
              <button
                className="banco-modal-close"
                disabled={formSubmitting}
                onClick={() => setCreateEditModal({ isOpen: false, mode: 'create', project: null })}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveForm}>
              <div className="banco-modal-body">
                {formError && (
                  <div className="settings-alert settings-alert--error">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="banco-form">
                  {/* Title */}
                  <div className="banco-field">
                    <label className="banco-field-label">Título del proyecto *</label>
                    <input
                      type="text"
                      required
                      className="banco-input"
                      placeholder="Ej: Sistema Inteligente para..."
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>

                  {/* Description */}
                  <div className="banco-field">
                    <label className="banco-field-label">Descripción completa *</label>
                    <textarea
                      required
                      className="banco-textarea"
                      placeholder="Explica detalladamente en qué consiste esta idea de proyecto de grado..."
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  {/* General Objective */}
                  <div className="banco-field">
                    <label className="banco-field-label">Objetivo general</label>
                    <textarea
                      className="banco-textarea"
                      placeholder="Objetivo principal del proyecto..."
                      rows={2}
                      value={formData.generalObjective}
                      onChange={(e) => setFormData({ ...formData, generalObjective: e.target.value })}
                    />
                  </div>

                  {/* Specific Objectives */}
                  <div className="banco-field">
                    <label className="banco-field-label">Objetivos específicos</label>
                    <textarea
                      className="banco-textarea"
                      placeholder="1. Primer objetivo&#10;2. Segundo objetivo&#10;3. Tercer objetivo"
                      rows={3}
                      value={formData.specificObjectives}
                      onChange={(e) => setFormData({ ...formData, specificObjectives: e.target.value })}
                    />
                  </div>

                  {/* Line & Subline Row */}
                  <div className="banco-form-row">
                    <div className="banco-field">
                      <label className="banco-field-label">Línea de investigación</label>
                      <div className="banco-select-wrap">
                        <select
                          className="banco-select"
                          value={formData.researchLineId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              researchLineId: e.target.value,
                              researchSublineId: '',
                            })
                          }
                        >
                          <option value="">— Seleccionar línea —</option>
                          {catalogs.lines.map((l) => (
                            <option key={l.research_line_id} value={l.research_line_id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="banco-select-chevron" />
                      </div>
                    </div>

                    <div className="banco-field">
                      <label className="banco-field-label">Sublínea de investigación</label>
                      <div className="banco-select-wrap">
                        <select
                          className="banco-select"
                          value={formData.researchSublineId}
                          onChange={(e) => setFormData({ ...formData, researchSublineId: e.target.value })}
                        >
                          <option value="">— Seleccionar sublínea —</option>
                          {filteredFormSublines.map((sl) => (
                            <option key={sl.research_subline_id} value={sl.research_subline_id}>
                              {sl.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="banco-select-chevron" />
                      </div>
                    </div>
                  </div>

                  {/* Program & Keywords Row */}
                  <div className="banco-form-row">
                    <div className="banco-field">
                      <label className="banco-field-label">Programa académico</label>
                      <div className="banco-select-wrap">
                        <select
                          className="banco-select"
                          value={formData.programId}
                          onChange={(e) => setFormData({ ...formData, programId: e.target.value })}
                        >
                          <option value="">— Seleccionar programa —</option>
                          {catalogs.programs.map((pr) => (
                            <option key={pr.program_id} value={pr.program_id}>
                              {pr.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="banco-select-chevron" />
                      </div>
                    </div>

                    <div className="banco-field">
                      <label className="banco-field-label">Palabras clave</label>
                      <input
                        type="text"
                        className="banco-input"
                        placeholder="Separadas por comas: IoT, IA, Nariño"
                        value={formData.keywords}
                        onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Observations */}
                  <div className="banco-field">
                    <label className="banco-field-label">Observaciones adicionales</label>
                    <textarea
                      className="banco-textarea"
                      placeholder="Información sobre convenios, convocatorias o contexto aplicable..."
                      rows={2}
                      value={formData.observations}
                      onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    />
                  </div>

                  {/* Proposer Info Display */}
                  <div
                    style={{
                      background: 'var(--bg-primary)',
                      padding: '12px 14px',
                      borderRadius: 'var(--border-radius-sm)',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <User size={15} style={{ color: 'var(--accent-primary)' }} />
                    <span>
                      Proponente: <strong>{user?.name || 'Usuario actual'}</strong> ({isAdmin ? 'Administrador' : 'Docente'}) • Estado inicial: <strong>Disponible</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="banco-modal-footer">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={formSubmitting}
                  onClick={() => setCreateEditModal({ isOpen: false, mode: 'create', project: null })}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={formSubmitting}
                >
                  {createEditModal.mode === 'create' ? 'Crear idea de proyecto' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
