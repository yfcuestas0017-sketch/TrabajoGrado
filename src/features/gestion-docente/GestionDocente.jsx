import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BookOpen, Briefcase, Check, ChevronDown, Gavel, Mail, Pencil, Search, Trash2, UserPlus, Users, X,
} from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import './GestionDocente.css';

export default function GestionDocente() {
  const { user } = useAuth();
  const userProgramId = user?.programId ?? null;
  const currentUserId = String(user?.user_id || user?.id || '');

  const [docentes, setDocentes] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(userProgramId ? String(userProgramId) : 'all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [detailDocente, setDetailDocente] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Consultar todos los docentes de la BD para el programa seleccionado y los proyectos
      const [teachersData, allProjects, catData] = await Promise.all([
        api.getTeachers(selectedProgramId, currentUserId).catch(() => []),
        api.getProjects(selectedProgramId).catch(() => []),
        api.getCatalogs().catch(() => ({ programs: [] })),
      ]);

      setPrograms(catData.programs || []);

      const docenteMap = {};

      // 2. Inicializar con TODOS los docentes registrados en la base de datos
      (teachersData || []).forEach((t) => {
        const uid = String(t.user_id);
        docenteMap[uid] = {
          user_id: uid,
          full_name: t.full_name || 'Sin nombre',
          email: t.email || '',
          program_name: t.program_name || 'Sin programa',
          programId: t.program_id,
          assignments: [],
        };
      });

      // 3. Contabilizar y asociar asignaciones reales de asesor y jurado desde proyectos
      (allProjects || []).forEach((p) => {
        (p.advisors || []).forEach((a) => {
          const id = String(a.id);
          if (!docenteMap[id]) {
            docenteMap[id] = {
              user_id: id,
              full_name: a.name || 'Sin nombre',
              email: a.email || '',
              program_name: a.program || null,
              programId: a.programId,
              assignments: [],
            };
          }
          docenteMap[id].assignments.push({
            project_id: p.id,
            title: p.title,
            code: p.code,
            line: p.line,
            role: 'asesor',
          });
        });

        (p.jurors || []).forEach((j) => {
          const id = String(j.id);
          if (!docenteMap[id]) {
            docenteMap[id] = {
              user_id: id,
              full_name: j.name || 'Sin nombre',
              email: j.email || '',
              program_name: j.program || null,
              programId: j.programId,
              assignments: [],
            };
          }
          docenteMap[id].assignments.push({
            project_id: p.id,
            title: p.title,
            code: p.code,
            line: p.line,
            role: 'jurado',
          });
        });
      });

      let docentesList = Object.values(docenteMap);
      if (selectedProgramId && selectedProgramId !== 'all') {
        docentesList = docentesList.filter((d) => !d.programId || String(d.programId) === String(selectedProgramId));
      }
      docentesList.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setDocentes(docentesList);
    } catch (err) {
      console.error('Error cargando docentes:', err);
      setError('Error al cargar información de gestión docente.');
    } finally {
      setLoading(false);
    }
  }, [selectedProgramId, currentUserId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Si el docente en detalle cambia tras recargar datos, sincronizarlo
  useEffect(() => {
    if (!detailDocente) return;
    const updated = docentes.find((d) => String(d.user_id) === String(detailDocente.user_id));
    if (updated) setDetailDocente(updated);
  }, [docentes]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredDocentes = docentes.filter((d) => {
    const text = search.toLowerCase();
    return d.full_name.toLowerCase().includes(text) || d.email.toLowerCase().includes(text);
  });

  const openDetail = (docente) => {
    setDetailDocente(docente);
    setActiveFilter(null);
  };

  const closeDetail = () => {
    setDetailDocente(null);
    setActiveFilter(null);
  };

  const asesorCount = detailDocente ? detailDocente.assignments.filter((a) => a.role === 'asesor').length : 0;
  const juradoCount = detailDocente ? detailDocente.assignments.filter((a) => a.role === 'jurado').length : 0;

  const visibleAssignments = useMemo(() => {
    if (!detailDocente) return [];
    if (!activeFilter) return detailDocente.assignments;
    return detailDocente.assignments.filter((a) => a.role === activeFilter);
  }, [detailDocente, activeFilter]);

  return (
    <DashboardLayout title="Gestión Docente" subtitle="Asignación y seguimiento de docentes, asesores y jurados">
      <div className="gd-page">
        {!detailDocente ? (
          <>
            <div className="gd-header">
              <div className="gd-search-bar">
                <Search size={16} className="gd-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar docente por nombre o correo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="gd-search-input"
                />
              </div>

              {/* Selector de Programa Académico */}
              <div className="gd-program-select-wrap">
                <select
                  className="gd-program-select"
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  disabled={user?.role?.toLowerCase() === 'estudiante'}
                >
                  <option value="all">Todos los programas</option>
                  {programs.map((pr) => (
                    <option key={pr.program_id} value={String(pr.program_id)}>
                      {pr.name} {userProgramId && String(pr.program_id) === String(userProgramId) ? ' (Tu programa)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="gd-program-chevron" />
              </div>
            </div>

            <div className="gd-meta">
              <div className="gd-meta-card">
                <span className="gd-meta-label">Docentes activos</span>
                <span className="gd-meta-value">{docentes.length}</span>
              </div>
              <div className="gd-meta-card">
                <span className="gd-meta-label">Asignaciones como asesor</span>
                <span className="gd-meta-value">
                  {docentes.reduce((acc, d) => acc + d.assignments.filter(a => a.role === 'asesor').length, 0)}
                </span>
              </div>
              <div className="gd-meta-card">
                <span className="gd-meta-label">Asignaciones como jurado</span>
                <span className="gd-meta-value">
                  {docentes.reduce((acc, d) => acc + d.assignments.filter(a => a.role === 'jurado').length, 0)}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="gd-empty">Cargando docentes...</div>
            ) : error ? (
              <div className="gd-error">{error}</div>
            ) : filteredDocentes.length === 0 ? (
              <div className="gd-empty">
                <Users size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
                <h3>No se encontraron docentes</h3>
                <p>Los docentes aparecen aquí en cuanto se les asigna un proyecto como asesor o jurado.</p>
              </div>
            ) : (
              <div className="gd-grid">
                {filteredDocentes.map(d => {
                  const asesorN = d.assignments.filter(a => a.role === 'asesor').length;
                  const juradoN = d.assignments.filter(a => a.role === 'jurado').length;
                  return (
                    <div key={d.user_id} className="gd-card" onClick={() => openDetail(d)}>
                      <div className="gd-card-avatar">{d.full_name.charAt(0).toUpperCase()}</div>
                      <div className="gd-card-body">
                        <h3 className="gd-card-name">{d.full_name}</h3>
                        <p className="gd-card-email"><Mail size={12} /> {d.email || 'Sin correo'}</p>
                        {d.program_name && <p className="gd-card-program">{d.program_name}</p>}
                        <div className="gd-card-stats">
                          <span className="gd-stat"><strong>{asesorN}</strong> como asesor</span>
                          <span className="gd-stat"><strong>{juradoN}</strong> como jurado</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="dp-layout">
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={closeDetail}>
              Volver a docentes
            </Button>

            <div className="dp-stats">
              <div
                className={`dp-stat-card dp-stat-card--btn${activeFilter === null ? ' dp-stat-card--active-amber' : ''}`}
                onClick={() => setActiveFilter(null)}
              >
                <div className="dp-stat-icon dp-stat-icon--blue"><Users size={18} /></div>
                <div>
                  <span className="dp-stat-label">Total de proyectos</span>
                  <span className="dp-stat-value">{detailDocente.assignments.length}</span>
                </div>
              </div>
              <div
                className={`dp-stat-card dp-stat-card--btn${activeFilter === 'asesor' ? ' dp-stat-card--active-amber' : ''}`}
                onClick={() => setActiveFilter('asesor')}
              >
                <div className="dp-stat-icon dp-stat-icon--amber"><Briefcase size={18} /></div>
                <div>
                  <span className="dp-stat-label">Como asesor</span>
                  <span className="dp-stat-value">{asesorCount}</span>
                </div>
              </div>
              <div
                className={`dp-stat-card dp-stat-card--btn${activeFilter === 'jurado' ? ' dp-stat-card--active-pink' : ''}`}
                onClick={() => setActiveFilter('jurado')}
              >
                <div className="dp-stat-icon dp-stat-icon--pink"><Gavel size={18} /></div>
                <div>
                  <span className="dp-stat-label">Como jurado</span>
                  <span className="dp-stat-value">{juradoCount}</span>
                </div>
              </div>
            </div>

            <div className="dp-body">
              <div className="dp-profile">
                <div className="dp-avatar">{detailDocente.full_name.charAt(0).toUpperCase()}</div>
                <h2 className="dp-name">{detailDocente.full_name}</h2>
              </div>
              <hr className="dp-divider" />
              <div className="dp-fields">
                <div className="dp-field">
                  <span className="dp-field-label">Correo electrónico</span>
                  <span className="dp-field-value">{detailDocente.email || 'Sin correo'}</span>
                </div>
                <div className="dp-field">
                  <span className="dp-field-label">Programa</span>
                  <span className="dp-field-value">{detailDocente.program_name || 'No especificado'}</span>
                </div>
              </div>
            </div>

            <div className="dp-projects-section">
              <div className="dp-projects-header">
                <h3 className="dp-projects-title">
                  {activeFilter === 'asesor' && 'Proyectos como asesor'}
                  {activeFilter === 'jurado' && 'Proyectos como jurado'}
                  {!activeFilter && 'Todos los proyectos asignados'}
                </h3>
                {activeFilter && (
                  <button className="dp-clear-filter" onClick={() => setActiveFilter(null)}>
                    <X size={12} /> Quitar filtro
                  </button>
                )}
              </div>

              {visibleAssignments.length === 0 ? (
                <div className="dp-no-projects">
                  <BookOpen size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>No hay proyectos asignados en esta categoría.</p>
                </div>
              ) : (
                <div className="dp-project-list">
                  {visibleAssignments.map((a, i) => (
                    <div key={`${a.project_id}-${a.role}-${i}`} className="dp-project-pill">
                      <span className={`dp-role-badge${a.role === 'jurado' ? ' dp-role-badge--jurado' : ''}`}>
                        {a.role === 'jurado' ? 'Jurado' : 'Asesor'}
                      </span>
                      <div className="dp-project-info">
                        <span className="dp-project-code">{a.code || `PR-${a.project_id}`}</span>
                        <span className="dp-project-title">{a.title}</span>
                        {a.line && <span className="dp-project-line">{a.line}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
