import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, ChevronDown, Mail, Pencil, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import './GestionDocente.css';

export default function GestionDocente() {
  const { user } = useAuth();
  const adminProgramId = user?.role?.toLowerCase() === 'administrador' ? (user?.programId ?? null) : null;

  const [docentes, setDocentes] = useState([]);
  const [lines, setLines] = useState([]);
  const [projects, setProjects] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [selectedDocenteId, setSelectedDocenteId] = useState('');
  const [assignLine, setAssignLine] = useState('');
  const [assignRole, setAssignRole] = useState('asesor');
  const [assignProject, setAssignProject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearchEmail, setAddSearchEmail] = useState('');
  const [addSearchResult, setAddSearchResult] = useState(null);
  const [addSearching, setAddSearching] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  const [detailDocente, setDetailDocente] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogs, allProjects] = await Promise.all([
        api.getCatalogs(),
        api.getProjects(),
      ]);

      setLines(catalogs.lines || []);
      setPrograms(catalogs.programs || []);
      setProjects(allProjects || []);

      // Extract unique advisors/teachers from user_projects
      const docenteMap = {};
      (allProjects || []).forEach(p => {
        (p.advisors || []).forEach(a => {
          if (a.id && !docenteMap[a.id]) {
            docenteMap[a.id] = {
              user_id: a.id,
              full_name: a.name,
              email: a.email || '',
              program_name: a.program || null,
              assignments: [],
            };
          }
          if (a.id) {
            docenteMap[a.id].assignments.push({
              project_id: p.id,
              title: p.title,
              code: p.code,
              role: 'asesor',
            });
          }
        });
      });

      setDocentes(Object.values(docenteMap));
    } catch (err) {
      console.error('Error cargando docentes:', err);
      setError('Error al cargar información de gestión docente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearchEmail = async () => {
    if (!addSearchEmail.trim()) return;
    setAddSearching(true);
    setAddError('');
    setAddSearchResult(null);
    try {
      const res = await api.checkCoauthor(addSearchEmail.trim());
      setAddSearchResult(res.user);
    } catch (err) {
      setAddError(err.message || 'Usuario no encontrado.');
    } finally {
      setAddSearching(false);
    }
  };

  const filteredDocentes = docentes.filter(d => {
    const text = search.toLowerCase();
    return d.full_name.toLowerCase().includes(text) || d.email.toLowerCase().includes(text);
  });

  return (
    <DashboardLayout title="Gestión Docente" subtitle="Asignación y seguimiento de docentes y asesores">
      <div className="gd-page">
        <div className="gd-header">
          <div className="gd-search">
            <Search size={16} className="gd-search-icon" />
            <input
              type="text"
              placeholder="Buscar docente por nombre o correo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="gd-search-input"
            />
          </div>
          <Button variant="primary" icon={UserPlus} onClick={() => setShowAddModal(true)}>
            Registrar Docente
          </Button>
        </div>

        {loading ? (
          <div className="gd-loading">Cargando docentes...</div>
        ) : error ? (
          <div className="gd-error">{error}</div>
        ) : filteredDocentes.length === 0 ? (
          <div className="gd-empty">No se encontraron docentes asignados.</div>
        ) : (
          <div className="gd-grid">
            {filteredDocentes.map(d => (
              <div key={d.user_id} className="gd-card" onClick={() => setDetailDocente(d)}>
                <div className="gd-card-header">
                  <div className="gd-avatar">{d.full_name.charAt(0)}</div>
                  <div>
                    <h3 className="gd-name">{d.full_name}</h3>
                    <p className="gd-email">{d.email}</p>
                  </div>
                </div>
                <div className="gd-card-body">
                  <span className="gd-pill">{d.assignments.length} proyectos asignados</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Registrar Docente */}
        {showAddModal && (
          <div className="epm-backdrop" onClick={() => setShowAddModal(false)}>
            <div className="epm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
              <div className="epm-header">
                <div>
                  <h2 className="epm-title">Buscar docente</h2>
                  <span className="epm-code">Ingresa el correo institucional del docente</span>
                </div>
                <button className="epm-close-btn" onClick={() => setShowAddModal(false)}><X size={16} /></button>
              </div>
              <div className="epm-body" style={{ padding: 20 }}>
                <div className="epm-field">
                  <label>Correo electrónico</label>
                  <input
                    type="email"
                    value={addSearchEmail}
                    onChange={e => setAddSearchEmail(e.target.value)}
                    placeholder="docente@universidad.edu.co"
                  />
                </div>
                <div style={{ marginTop: 15 }}>
                  <Button variant="primary" onClick={handleSearchEmail} loading={addSearching} fullWidth>
                    {addSearching ? 'Buscando...' : 'Buscar'}
                  </Button>
                </div>
                {addError && <p className="epm-inline-error" style={{ marginTop: 10 }}>{addError}</p>}
                {addSearchResult && (
                  <div className="gd-search-found" style={{ marginTop: 15, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                    <strong>{addSearchResult.full_name}</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{addSearchResult.email}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
