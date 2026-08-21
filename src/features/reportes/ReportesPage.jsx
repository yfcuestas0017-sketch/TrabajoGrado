import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Filter,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Building2,
  BookOpen,
  Users,
  History,
} from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { generateProjectPdf, generateConsolidatedPdf } from '../../lib/reportPdfGenerator';
import { generateProjectDocx, generateConsolidatedDocx } from '../../lib/reportDocxGenerator';
import './ReportesPage.css';

export default function ReportesPage() {
  const { user } = useAuth();
  const userProgramId = user?.programId ?? null;
  const userProgramName = user?.programName || '';

  const [activeTab, setActiveTab] = useState('general');

  // Catalogs
  const [catalogs, setCatalogs] = useState({ statuses: [], modalities: [], lines: [], sublines: [], semesters: [] });

  // All projects (raw from /api/projects)
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState('');

  // Filters — all optional
  const [filters, setFilters] = useState({
    search: '',
    statusId: 'all',
    modalityId: 'all',
    lineId: 'all',
    semesterNumber: 'all',
    advisorId: 'all',
    startDate: '',
    endDate: '',
  });

  // Individual project
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectDetail, setSelectedProjectDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [allProjects, cats] = await Promise.all([
        api.getProjects(),
        api.getCatalogs(),
      ]);

      setCatalogs(cats || {});

      // Map raw projects — /api/projects already returns the correct shape
      let mapped = (allProjects || []).map(row => {
        const createdDate = row.created_at ? new Date(row.created_at) : null;
        const year = createdDate ? createdDate.getFullYear() : null;
        const month = createdDate ? createdDate.getMonth() + 1 : null;
        const academicPeriod = row.academicPeriod ||
          (year ? `${year}-${month <= 6 ? '1' : '2'}` : 'Sin periodo');

        return {
          id: row.id || row.project_id,
          title: row.title || 'Sin título',
          code: row.code || `PR-${row.id || row.project_id}`,
          status: row.status || 'Sin estado',
          statusId: row.statusId || '',
          modality: row.modality || 'Sin modalidad',
          modalityId: row.modalityId || '',
          line: row.line || 'Sin línea',
          lineId: row.lineId || '',
          subline: row.subline || 'Sin sublínea',
          programName: row.programName || 'Sin programa',
          programId: row.programId || null,
          facultyName: row.facultyName || 'Sin facultad',
          semesterNumber: row.semesterNumber || null,
          academicPeriod,
          created_at: row.created_at,
          finished_at: row.finished_at,
          letterLink: row.letterLink || '',
          authors: (row.authors || []).map(a => ({
            id: a.id, name: a.name, email: a.email, role: a.role, semesterNumber: a.semesterNumber,
          })),
          advisors: (row.advisors || []).map(a => ({
            id: a.id, name: a.name, email: a.email,
          })),
          jurors: (row.jurors || []).map(a => ({
            id: a.id, name: a.name, email: a.email,
          })),
          user_projects: row.user_projects || [],
        };
      });

      // Apply strict program isolation for all users and administrators
      if (userProgramId !== null) {
        mapped = mapped.filter(p => String(p.programId) === String(userProgramId));
      }

      setProjects(mapped);
      if (mapped.length > 0 && !selectedProjectId) {
        setSelectedProjectId(String(mapped[0].id));
      }
    } catch (err) {
      console.error('Error cargando proyectos para reportes:', err);
      setError('No fue posible cargar la información de proyectos. Verifica la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [userProgramId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Load individual project detail ────────────────────────────────────────
  useEffect(() => {
    if (!selectedProjectId) { setSelectedProjectDetail(null); return; }
    let alive = true;

    const fetchDetail = async () => {
      setLoadingDetail(true);
      setDetailError('');
      try {
        // Use the project already in state as base
        const base = projects.find(p => String(p.id) === String(selectedProjectId));
        if (!base) { setSelectedProjectDetail(null); return; }

        // Enrich with history
        let history = [];
        try {
          const histRes = await api.getProjectHistory(selectedProjectId);
          history = (histRes || []).map(h => ({
            history_id: h.history_id,
            change_type: h.change_type || 'MODIFICACIÓN',
            description: h.description || null,
            modified_field: h.modified_field || null,
            old_value: h.old_value || null,
            new_value: h.new_value || null,
            changed_at: h.changed_at,
          }));
        } catch (_) { /* history is optional */ }

        // Enrich with research progress and documents if user id available
        let progress = [];
        let documents = [];
        if (user?.id) {
          try {
            const [prog, docs] = await Promise.all([
              api.getResearchProgress(selectedProjectId, user.id),
              api.getResearchDocuments(selectedProjectId, user.id),
            ]);
            progress = prog || [];
            documents = docs || [];
          } catch (_) { /* optional */ }
        }

        if (alive) setSelectedProjectDetail({ ...base, history, progress, documents });
      } catch (err) {
        if (alive) setDetailError('Error al cargar los detalles del proyecto.');
      } finally {
        if (alive) setLoadingDetail(false);
      }
    };

    fetchDetail();
    return () => { alive = false; };
  }, [selectedProjectId, projects, user?.id]);

  // ── Unique Advisors ────────────────────────────────────────────────────────
  const advisorsList = useMemo(() => {
    const map = new Map();
    projects.forEach(p => {
      (p.advisors || []).forEach(adv => {
        if (adv.id && adv.name) map.set(String(adv.id), adv.name);
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [projects]);

  // ── Filtered Projects (all filters optional) ──────────────────────────────
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        const inTitle = (p.title || '').toLowerCase().includes(term);
        const inCode = (p.code || '').toLowerCase().includes(term);
        const inAuthor = (p.authors || []).some(a => (a.name || '').toLowerCase().includes(term));
        const inAdvisor = (p.advisors || []).some(a => (a.name || '').toLowerCase().includes(term));
        const inLine = (p.line || '').toLowerCase().includes(term);
        if (!inTitle && !inCode && !inAuthor && !inAdvisor && !inLine) return false;
      }
      if (filters.statusId !== 'all' && String(p.statusId) !== String(filters.statusId)) return false;
      if (filters.modalityId !== 'all' && String(p.modalityId) !== String(filters.modalityId)) return false;
      if (filters.lineId !== 'all' && String(p.lineId) !== String(filters.lineId)) return false;
      if (filters.semesterNumber !== 'all' && String(p.semesterNumber) !== String(filters.semesterNumber)) return false;
      if (filters.advisorId !== 'all') {
        const hasAdv = (p.advisors || []).some(a => String(a.id) === String(filters.advisorId));
        if (!hasAdv) return false;
      }
      if (filters.startDate) {
        if (!p.created_at || new Date(p.created_at) < new Date(filters.startDate)) return false;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (!p.created_at || new Date(p.created_at) > end) return false;
      }
      return true;
    });
  }, [projects, filters]);

  // Projects matching individual search
  const selectableProjects = useMemo(() => {
    if (!projectSearchTerm.trim()) return projects;
    const term = projectSearchTerm.trim().toLowerCase();
    return projects.filter(p =>
      (p.title || '').toLowerCase().includes(term) ||
      (p.code || '').toLowerCase().includes(term) ||
      (p.authors || []).some(a => (a.name || '').toLowerCase().includes(term))
    );
  }, [projects, projectSearchTerm]);

  const handleResetFilters = () => setFilters({
    search: '', statusId: 'all', modalityId: 'all', lineId: 'all',
    semesterNumber: 'all', advisorId: 'all', startDate: '', endDate: '',
  });

  const getActiveFilterSummary = () => ({
    programName: userProgramName || 'Todos los programas',
    statusName: filters.statusId !== 'all' ? catalogs.statuses?.find(s => String(s.status_id) === String(filters.statusId))?.name : null,
    modalityName: filters.modalityId !== 'all' ? catalogs.modalities?.find(m => String(m.modality_id) === String(filters.modalityId))?.name : null,
    lineName: filters.lineId !== 'all' ? catalogs.lines?.find(l => String(l.research_line_id) === String(filters.lineId))?.name : null,
    semesterName: filters.semesterNumber !== 'all' ? `${filters.semesterNumber}° Semestre` : null,
    advisorName: filters.advisorId !== 'all' ? advisorsList.find(a => String(a.id) === String(filters.advisorId))?.name : null,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
  });

  // ── Export Handlers ────────────────────────────────────────────────────────
  const handleExportConsolidatedPdf = async () => {
    if (!filteredProjects.length) { setError('No hay proyectos para exportar.'); return; }
    setDownloadingPdf(true); setDownloadSuccess(''); setError('');
    try {
      generateConsolidatedPdf(filteredProjects, getActiveFilterSummary(), user);
      setDownloadSuccess(`Reporte PDF generado: ${filteredProjects.length} proyectos.`);
    } catch (err) { setError(err.message || 'Error al generar PDF.'); }
    finally { setDownloadingPdf(false); }
  };

  const handleExportConsolidatedDocx = async () => {
    if (!filteredProjects.length) { setError('No hay proyectos para exportar.'); return; }
    setDownloadingDocx(true); setDownloadSuccess(''); setError('');
    try {
      await generateConsolidatedDocx(filteredProjects, getActiveFilterSummary(), user);
      setDownloadSuccess(`Reporte Word generado: ${filteredProjects.length} proyectos.`);
    } catch (err) { setError(err.message || 'Error al generar Word.'); }
    finally { setDownloadingDocx(false); }
  };

  const handleExportSinglePdf = async () => {
    if (!selectedProjectDetail) { setError('Selecciona un proyecto válido.'); return; }
    setDownloadingPdf(true); setDownloadSuccess(''); setError('');
    try {
      generateProjectPdf(selectedProjectDetail, user);
      setDownloadSuccess(`PDF del proyecto ${selectedProjectDetail.code} descargado.`);
    } catch (err) { setError(err.message || 'Error al generar PDF.'); }
    finally { setDownloadingPdf(false); }
  };

  const handleExportSingleDocx = async () => {
    if (!selectedProjectDetail) { setError('Selecciona un proyecto válido.'); return; }
    setDownloadingDocx(true); setDownloadSuccess(''); setError('');
    try {
      await generateProjectDocx(selectedProjectDetail, user);
      setDownloadSuccess(`Word del proyecto ${selectedProjectDetail.code} descargado.`);
    } catch (err) { setError(err.message || 'Error al generar Word.'); }
    finally { setDownloadingDocx(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout
      title="Generación de Reportes"
      subtitle="Exportación institucional de proyectos de grado en PDF y Word (.docx)"
    >
      <div className="reportes-container">
        {/* Scope Banner */}
        <div className="reportes-scope-banner">
          <div className="scope-info">
            <div className="scope-icon-wrap"><Building2 size={22} /></div>
            <div>
              <span className="scope-tag">Ámbito Institucional</span>
              <h3 className="scope-title">
                {userProgramName ? `Programa: ${userProgramName}` : 'Reportes — Todos los Programas'}
              </h3>
              <p className="scope-desc">
                {loading ? 'Cargando proyectos...' : `${projects.length} proyecto${projects.length !== 1 ? 's' : ''} disponible${projects.length !== 1 ? 's' : ''} en el sistema.`}
              </p>
            </div>
          </div>
          <div className="scope-meta">
            <span className="scope-user"><strong>Administrador:</strong> {user?.name || 'Usuario'}</span>
            <span className="scope-time"><strong>Fecha:</strong> {new Date().toLocaleDateString('es-CO')}</span>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="reportes-alert reportes-alert--error">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button type="button" className="alert-close" onClick={() => setError('')}>×</button>
          </div>
        )}
        {downloadSuccess && (
          <div className="reportes-alert reportes-alert--success">
            <CheckCircle size={18} />
            <span>{downloadSuccess}</span>
            <button type="button" className="alert-close" onClick={() => setDownloadSuccess('')}>×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="reportes-tab-nav">
          <button
            type="button"
            className={`reportes-tab-btn ${activeTab === 'general' ? 'reportes-tab-btn--active' : ''}`}
            onClick={() => { setActiveTab('general'); setDownloadSuccess(''); }}
          >
            <FileSpreadsheet size={18} />
            <span>Reporte Consolidado</span>
            {!loading && <span className="tab-badge">{projects.length}</span>}
          </button>
          <button
            type="button"
            className={`reportes-tab-btn ${activeTab === 'individual' ? 'reportes-tab-btn--active' : ''}`}
            onClick={() => { setActiveTab('individual'); setDownloadSuccess(''); }}
          >
            <FileText size={18} />
            <span>Reporte de Proyecto Específico</span>
          </button>
        </div>

        {/* ── TAB: CONSOLIDADO ── */}
        {activeTab === 'general' && (
          <div className="reportes-tab-content">
            {/* Filters (all optional) */}
            <div className="reportes-filters-card">
              <div className="filters-card-header">
                <div className="filters-title">
                  <Filter size={18} />
                  <h4>Filtros de Búsqueda <span className="filters-optional">(todos opcionales)</span></h4>
                </div>
                <button type="button" className="btn-clean-filters" onClick={handleResetFilters}>
                  <RefreshCw size={14} />
                  <span>Limpiar filtros</span>
                </button>
              </div>

              <div className="filters-grid">
                {/* Search */}
                <div className="filter-group filter-group--wide">
                  <label htmlFor="filter-search">Búsqueda libre (código, título, autor, asesor o línea)</label>
                  <div className="input-search-wrap">
                    <Search size={16} />
                    <input
                      id="filter-search"
                      type="text"
                      placeholder="Escribe cualquier término para filtrar..."
                      value={filters.search}
                      onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="filter-group">
                  <label htmlFor="filter-status">Estado</label>
                  <select id="filter-status" value={filters.statusId} onChange={e => setFilters(p => ({ ...p, statusId: e.target.value }))}>
                    <option value="all">Todos los estados</option>
                    {(catalogs.statuses || []).map(s => (
                      <option key={s.status_id} value={s.status_id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Modality */}
                <div className="filter-group">
                  <label htmlFor="filter-modality">Modalidad</label>
                  <select id="filter-modality" value={filters.modalityId} onChange={e => setFilters(p => ({ ...p, modalityId: e.target.value }))}>
                    <option value="all">Todas las modalidades</option>
                    {(catalogs.modalities || []).map(m => (
                      <option key={m.modality_id} value={m.modality_id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* Research Line */}
                <div className="filter-group">
                  <label htmlFor="filter-line">Línea de Investigación</label>
                  <select id="filter-line" value={filters.lineId} onChange={e => setFilters(p => ({ ...p, lineId: e.target.value }))}>
                    <option value="all">Todas las líneas</option>
                    {(catalogs.lines || []).map(l => (
                      <option key={l.research_line_id} value={l.research_line_id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                {/* Semester */}
                <div className="filter-group">
                  <label htmlFor="filter-semester">Semestre del Estudiante</label>
                  <select id="filter-semester" value={filters.semesterNumber} onChange={e => setFilters(p => ({ ...p, semesterNumber: e.target.value }))}>
                    <option value="all">Todos los semestres</option>
                    <option value="8">8° Semestre (Investigación I)</option>
                    <option value="9">9° Semestre (Investigación II)</option>
                    <option value="10">10° Semestre (Investigación III)</option>
                  </select>
                </div>

                {/* Advisor */}
                <div className="filter-group">
                  <label htmlFor="filter-advisor">Docente Asesor</label>
                  <select id="filter-advisor" value={filters.advisorId} onChange={e => setFilters(p => ({ ...p, advisorId: e.target.value }))}>
                    <option value="all">Todos los asesores</option>
                    {advisorsList.map(adv => (
                      <option key={adv.id} value={adv.id}>{adv.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div className="filter-group">
                  <label htmlFor="filter-start-date">Fecha Registro Desde</label>
                  <input id="filter-start-date" type="date" value={filters.startDate} onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))} />
                </div>

                {/* Date To */}
                <div className="filter-group">
                  <label htmlFor="filter-end-date">Fecha Registro Hasta</label>
                  <input id="filter-end-date" type="date" value={filters.endDate} onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Export Toolbar */}
            <div className="reportes-export-toolbar">
              <div className="toolbar-stats">
                <span className="stats-badge">
                  <strong>{filteredProjects.length}</strong> de {projects.length} proyectos seleccionados
                </span>
                {filters.search && <span className="stats-filter-tag">Búsqueda: "{filters.search}"</span>}
                {filters.statusId !== 'all' && <span className="stats-filter-tag">Estado activo</span>}
                {filters.semesterNumber !== 'all' && <span className="stats-filter-tag">Semestre {filters.semesterNumber}°</span>}
              </div>
              <div className="toolbar-buttons">
                <button
                  type="button"
                  className="btn-export-pdf"
                  disabled={downloadingPdf || filteredProjects.length === 0 || loading}
                  onClick={handleExportConsolidatedPdf}
                >
                  <Download size={16} />
                  <span>{downloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
                </button>
                <button
                  type="button"
                  className="btn-export-docx"
                  disabled={downloadingDocx || filteredProjects.length === 0 || loading}
                  onClick={handleExportConsolidatedDocx}
                >
                  <Download size={16} />
                  <span>{downloadingDocx ? 'Generando Word...' : 'Descargar Word (.docx)'}</span>
                </button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="reportes-preview-card">
              <div className="preview-header">
                <h4>
                  Vista previa del reporte
                  {filteredProjects.length > 0 && ` — ${filteredProjects.length} proyecto${filteredProjects.length !== 1 ? 's' : ''}`}
                </h4>
              </div>

              {loading ? (
                <div className="reportes-loading">
                  <RefreshCw size={24} className="spin" />
                  <p>Cargando proyectos registrados en el sistema...</p>
                </div>
              ) : projects.length === 0 ? (
                <div className="reportes-empty">
                  <AlertCircle size={32} />
                  <p className="empty-title">No hay proyectos registrados en el sistema</p>
                  <p className="empty-subtitle">Registra proyectos en la sección "Gestión de Proyectos" para poder generar reportes.</p>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="reportes-empty">
                  <Search size={32} />
                  <p className="empty-title">Ningún proyecto coincide con los filtros aplicados</p>
                  <p className="empty-subtitle">
                    Modifica o limpia los filtros para ver resultados.{' '}
                    <button type="button" className="link-btn" onClick={handleResetFilters}>Limpiar filtros</button>
                  </p>
                </div>
              ) : (
                <div className="reportes-table-responsive">
                  <table className="reportes-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Código</th>
                        <th>Título del Proyecto</th>
                        <th>Modalidad</th>
                        <th>Línea</th>
                        <th>Estado</th>
                        <th>Sem.</th>
                        <th>Autores / Estudiantes</th>
                        <th>Asesor</th>
                        <th>Fecha Reg.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjects.map((p, idx) => {
                        const authorsStr = (p.authors || []).map(a => a.name).filter(Boolean).join(', ') || '—';
                        const advisorStr = (p.advisors || []).map(a => a.name).filter(Boolean).join(', ') || '—';
                        const semStr = p.semesterNumber ? `${p.semesterNumber}°` : '—';
                        const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString('es-CO') : '—';

                        return (
                          <tr key={p.id}
                            className={String(selectedProjectId) === String(p.id) ? 'row-selected' : ''}
                            onClick={() => setSelectedProjectId(String(p.id))}
                          >
                            <td className="cell-num">{idx + 1}</td>
                            <td className="cell-code"><span>{p.code}</span></td>
                            <td className="cell-title" title={p.title}>{p.title}</td>
                            <td>{p.modality}</td>
                            <td>{p.line}</td>
                            <td><span className="status-pill">{p.status}</span></td>
                            <td className="cell-sem">{semStr}</td>
                            <td className="cell-authors">{authorsStr}</td>
                            <td className="cell-advisor">{advisorStr}</td>
                            <td className="cell-date">{dateStr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: PROYECTO ESPECÍFICO ── */}
        {activeTab === 'individual' && (
          <div className="reportes-tab-content">
            {/* Project Selector */}
            <div className="reportes-select-card">
              <div className="select-card-header">
                <BookOpen size={18} />
                <h4>Selecciona el Proyecto para Generar su Ficha Técnica</h4>
              </div>
              <div className="select-project-row">
                <div className="select-dropdown-wrap">
                  <label htmlFor="select-project-dropdown">Proyecto ({projects.length} disponibles):</label>
                  <select
                    id="select-project-dropdown"
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    disabled={loading || projects.length === 0}
                  >
                    {projects.length === 0
                      ? <option value="">— No hay proyectos disponibles —</option>
                      : <>
                          <option value="" disabled>— Selecciona un proyecto —</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.code ? `[${p.code}] ` : ''}{p.title}
                            </option>
                          ))}
                        </>
                    }
                  </select>
                </div>
                <div className="select-search-wrap">
                  <label htmlFor="select-project-search">Buscar proyecto:</label>
                  <input
                    id="select-project-search"
                    type="text"
                    placeholder="Código, título o nombre del autor..."
                    value={projectSearchTerm}
                    onChange={e => setProjectSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick match chips when searching */}
              {projectSearchTerm.trim() && (
                <div className="quick-matches-list">
                  <span className="matches-label">Resultados ({selectableProjects.length}):</span>
                  <div className="matches-chips">
                    {selectableProjects.slice(0, 10).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className={`chip-btn ${String(selectedProjectId) === String(p.id) ? 'chip-btn--active' : ''}`}
                        onClick={() => { setSelectedProjectId(String(p.id)); setProjectSearchTerm(''); }}
                      >
                        <strong>{p.code}</strong>: {p.title.slice(0, 50)}{p.title.length > 50 ? '…' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dossier */}
            {loading ? (
              <div className="reportes-loading">
                <RefreshCw size={24} className="spin" />
                <p>Cargando proyectos...</p>
              </div>
            ) : loadingDetail ? (
              <div className="reportes-loading">
                <RefreshCw size={24} className="spin" />
                <p>Cargando ficha técnica del proyecto...</p>
              </div>
            ) : detailError ? (
              <div className="reportes-alert reportes-alert--error">
                <AlertCircle size={18} />
                <span>{detailError}</span>
              </div>
            ) : selectedProjectDetail ? (
              <div className="reportes-dossier-card">
                {/* Header */}
                <div className="dossier-header">
                  <div className="dossier-main-info">
                    <div className="dossier-badges">
                      <span className="code-badge">{selectedProjectDetail.code}</span>
                      <span className="status-badge">{selectedProjectDetail.status}</span>
                      <span className="modality-badge">{selectedProjectDetail.modality}</span>
                      {selectedProjectDetail.semesterNumber && (
                        <span className="semester-badge">{selectedProjectDetail.semesterNumber}° Semestre</span>
                      )}
                    </div>
                    <h3 className="dossier-title">{selectedProjectDetail.title}</h3>
                    <p className="dossier-meta">
                      <span><strong>Programa:</strong> {selectedProjectDetail.programName}</span>
                      <span><strong>Registro:</strong> {selectedProjectDetail.created_at ? new Date(selectedProjectDetail.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</span>
                      {selectedProjectDetail.academicPeriod && (
                        <span><strong>Periodo:</strong> {selectedProjectDetail.academicPeriod}</span>
                      )}
                    </p>
                  </div>
                  <div className="dossier-export-actions">
                    <button type="button" className="btn-export-pdf" disabled={downloadingPdf} onClick={handleExportSinglePdf}>
                      <Download size={16} />
                      <span>{downloadingPdf ? 'Generando...' : 'Descargar PDF'}</span>
                    </button>
                    <button type="button" className="btn-export-docx" disabled={downloadingDocx} onClick={handleExportSingleDocx}>
                      <Download size={16} />
                      <span>{downloadingDocx ? 'Generando...' : 'Descargar Word (.docx)'}</span>
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="dossier-sections-grid">
                  <div className="dossier-section">
                    <h5 className="section-title"><BookOpen size={16} /> Información Académica</h5>
                    <div className="info-list">
                      <div className="info-item"><span className="info-label">Línea de investigación:</span><span className="info-val">{selectedProjectDetail.line}</span></div>
                      <div className="info-item"><span className="info-label">Sublínea:</span><span className="info-val">{selectedProjectDetail.subline}</span></div>
                      <div className="info-item"><span className="info-label">Periodo académico:</span><span className="info-val">{selectedProjectDetail.academicPeriod}</span></div>
                      <div className="info-item">
                        <span className="info-label">Carta de aprobación:</span>
                        <span className="info-val">
                          {selectedProjectDetail.letterLink
                            ? <a href={selectedProjectDetail.letterLink} target="_blank" rel="noopener noreferrer" className="link-external">Ver carta <ExternalLink size={12} /></a>
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="dossier-section">
                    <h5 className="section-title"><Users size={16} /> Equipo Vinculado</h5>
                    <div className="team-groups">
                      <div className="team-subgroup">
                        <span className="team-role-label">Estudiantes / Autores:</span>
                        {(selectedProjectDetail.authors || []).length > 0
                          ? <ul className="team-list">{selectedProjectDetail.authors.map((a, i) => (
                              <li key={i}><strong>{a.name}</strong> ({a.email || '—'})
                                {a.semesterNumber && <span className="sem-chip">{a.semesterNumber}° Sem</span>}
                              </li>
                            ))}</ul>
                          : <p className="team-none">Sin autores registrados</p>
                        }
                      </div>
                      <div className="team-subgroup">
                        <span className="team-role-label">Docente Asesor:</span>
                        {(selectedProjectDetail.advisors || []).length > 0
                          ? <ul className="team-list">{selectedProjectDetail.advisors.map((a, i) => <li key={i}><strong>{a.name}</strong> ({a.email || '—'})</li>)}</ul>
                          : <p className="team-none">Sin asesor asignado</p>
                        }
                      </div>
                      <div className="team-subgroup">
                        <span className="team-role-label">Jurados:</span>
                        {(selectedProjectDetail.jurors || []).length > 0
                          ? <ul className="team-list">{selectedProjectDetail.jurors.map((j, i) => <li key={i}><strong>{j.name}</strong> ({j.email || '—'})</li>)}</ul>
                          : <p className="team-none">Sin jurados asignados</p>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* History Timeline */}
                <div className="dossier-timeline-section">
                  <h5 className="section-title"><History size={16} /> Historial de Modificaciones</h5>
                  {(selectedProjectDetail.history || []).length === 0
                    ? <p className="history-empty">Sin modificaciones registradas posteriores a la creación del proyecto.</p>
                    : (
                      <div className="timeline-flow">
                        {selectedProjectDetail.history.map((h, i) => (
                          <div key={i} className="timeline-item">
                            <div className="timeline-dot" />
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <span className="timeline-type">{h.change_type || 'MODIFICACIÓN'}</span>
                                <span className="timeline-date">{h.changed_at ? new Date(h.changed_at).toLocaleString('es-CO') : '—'}</span>
                              </div>
                              <p className="timeline-desc">
                                {h.description || (h.modified_field ? `${h.modified_field}: "${h.old_value || '—'}" → "${h.new_value || '—'}"` : 'Actualización registrada')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              </div>
            ) : (
              <div className="reportes-empty">
                <BookOpen size={32} />
                <p className="empty-title">
                  {projects.length === 0
                    ? 'No hay proyectos registrados en el sistema'
                    : 'Selecciona un proyecto para generar su ficha técnica'}
                </p>
                {projects.length === 0 && (
                  <p className="empty-subtitle">Registra proyectos en "Gestión de Proyectos" para poder exportar reportes individuales.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
