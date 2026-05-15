import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, BookOpen, ChevronDown, Download, ExternalLink, Eye, FilePlus2, Filter, History, Pencil,
  Settings, Trash2, Upload, Users, X,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { getSupabaseClient } from '../lib/supabase/client';
import EditProjectModal from './EditProjectModal'; 
import CreateProjectModal from './CrearProyecto'; 
import {
  hasSupabaseConfig,
  hasSupabaseConfigAttempt,
  supabaseConfigError,
} from '../lib/supabase/config';


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
  });
  const [selectedId, setSelectedId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [ownedProjectIds, setOwnedProjectIds] = useState(new Set());
  const [statuses, setStatuses] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [lines, setLines] = useState([]);
  const [sublines, setSublines] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
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
  
  const [editProjectId, setEditProjectId] = useState(null);

  // ── modales ─────────────────────────────────────────────
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
    setShowCreateModal(true);
    setFormError('');
    setFormSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    setShowCreateModal(false);
    setEditProjectId(null);
    setFormData({
      title: '', code: '', statusId: '', modalityId: '', lineId: '', sublineId: '', letterLink: '', coauthors: [],
    });
    setNewCoauthorEmail('');
  };

  const fetchHistory = async (projectId) => {
    if (!projectId || !hasSupabaseConfig) return;

    setHistoryLoading(true);

    const supabase = getSupabaseClient();
    const { data, error: historyError } = await supabase
      .from('project_histories')
      .select(
        'project_history_id, history:histories(description, modified_field, old_value, new_value, change_type, changed_at)',
      )
      .eq('project_id', projectId)
      .order('project_history_id', { ascending: false });

    if (historyError) {
      setHistoryItems([]);
      setHistoryLoading(false);
      return;
    }

    const mappedHistory = (data ?? []).map((row) => {
      const history = row.history || {};
      const title = history.description || 'Actualizacion registrada';
      const detail = history.modified_field
        ? `${history.modified_field}: ${history.old_value ?? '-'} -> ${history.new_value ?? '-'}`
        : history.change_type || 'Actualizacion';
      const date = history.changed_at
        ? new Date(history.changed_at).toLocaleDateString('es-CO')
        : 'Sin fecha';

      return {
        id: row.project_history_id,
        title,
        detail,
        date,
      };
    });

    setHistoryItems(mappedHistory);
    setHistoryLoading(false);
  };

  const loadData = useCallback(async () => {
    if (hasSupabaseConfigAttempt && !hasSupabaseConfig) {
      setError(supabaseConfigError);
      setLoading(false);
      return;
    }

    if (!hasSupabaseConfig) {
      setError('Supabase no esta configurado. Completa .env.local para continuar.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const supabase = getSupabaseClient();

    // ── Obtener IDs de proyectos del usuario actual (siempre) ────
    let ownedIds = new Set();
    if (user?.id) {
      const { data: upRows } = await supabase
        .from('user_projects')
        .select('project_id')
        .eq('user_id', user.id);
      ownedIds = new Set((upRows ?? []).map((r) => r.project_id));
      setOwnedProjectIds(ownedIds);
    }

    // ── Construir query de proyectos ─────────────────────────────
    let projectsQuery = supabase
      .from('projects')
      .select(
        'project_id, title, code, created_at, letter_link, research_line:research_lines(research_line_id, name), research_subline:research_sublines(research_subline_id, name), status:statuses(status_id, name), modality:modalities(modality_id, name), user_projects(user_id, project_role, users(full_name, email))',
      )
      .order('created_at', { ascending: false });

    // Estudiante o Docente: filtrar solo sus proyectos asignados
    let skipProjects = false;
    if (isLimitedUser && ownedIds.size > 0) {
      projectsQuery = projectsQuery.in('project_id', Array.from(ownedIds));
    } else if (isLimitedUser && ownedIds.size === 0) {
      skipProjects = true;
    }

    // Administrador con programa asignado: solo proyectos de usuarios de su programa
    if (adminProgramId !== null && !isLimitedUser) {
      const { data: programUserProjects } = await supabase
        .from('user_projects')
        .select('project_id, users!inner(program_id)')
        .eq('users.program_id', adminProgramId);
      const programProjectIds = [...new Set((programUserProjects || []).map(r => r.project_id))];
      if (programProjectIds.length > 0) {
        projectsQuery = projectsQuery.in('project_id', programProjectIds);
      } else {
        skipProjects = true;
      }
    }

    const [projectsResponse, statusResponse, modalityResponse, linesResponse, sublinesResponse] =
      await Promise.all([
        skipProjects ? Promise.resolve({ data: [], error: null }) : projectsQuery,
        supabase.from('statuses').select('status_id, name').order('name'),
        supabase.from('modalities').select('modality_id, name').order('name'),
        supabase.from('research_lines').select('research_line_id, name').order('name'),
        supabase
          .from('research_sublines')
          .select('research_subline_id, name, research_line_id')
          .order('name'),
      ]);

    if (projectsResponse.error) {
      setError('No fue posible cargar los proyectos desde la base de datos.');
      setProjects([]);
    } else {
      const mappedProjects = (projectsResponse.data ?? []).map((row) => {
        const year = row.created_at
          ? new Date(row.created_at).getFullYear().toString()
          : 'Sin fecha';
        const authorsArray = (row.user_projects ?? [])
          .filter(item => item.project_role === 'autor' || item.project_role === 'coautor' || !item.project_role)
          .map((item) => item.users?.full_name)
          .filter(Boolean);

        const asesores = (row.user_projects ?? [])
          .filter(item => item.project_role === 'asesor')
          .map(item => item.users?.full_name)
          .filter(Boolean);

        const jurados = (row.user_projects ?? [])
          .filter(item => item.project_role === 'jurado')
          .map(item => item.users?.full_name)
          .filter(Boolean);

        const coauthorsList = (row.user_projects ?? [])
          .filter(item => item.user_id !== user?.id)
          .map(item => ({
            id: item.user_id,
            name: item.users?.full_name,
            email: item.users?.email || ''
          }));

        return {
          id: row.project_id,
          code: row.code || `PR-${row.project_id}`,
          title: row.title,
          status: row.status?.name || 'Sin estado',
          statusId: row.status?.status_id || '',
          modality: row.modality?.name || 'Sin modalidad',
          modalityId: row.modality?.modality_id || '',
          line: row.research_line?.name || 'Sin linea',
          lineId: row.research_line?.research_line_id || '',
          subline: row.research_subline?.name || 'Sin sublinea',
          sublineId: row.research_subline?.research_subline_id || '',
          year,
          authorsArray: authorsArray.length > 0 ? authorsArray : ['Sin autores'],
          advisor: asesores.length > 0 ? asesores.join(', ') : 'Sin asignar',
          jurados: jurados.length > 0 ? jurados.join(', ') : 'Sin jurados',
          updatedAt: row.created_at,
          description: row.letter_link
            ? `Carta: ${row.letter_link}`
            : 'Sin descripcion registrada.',
          letterLink: row.letter_link || '',
          isOwned: ownedIds.has(row.project_id),
          coauthors: coauthorsList,
        };
      });

      setProjects(mappedProjects);
      setSelectedId(mappedProjects[0]?.id ?? null);
    }

    setStatuses(statusResponse.error ? [] : statusResponse.data ?? []);
    setModalities(modalityResponse.error ? [] : modalityResponse.data ?? []);
    setLines(linesResponse.error ? [] : linesResponse.data ?? []);
    setSublines(sublinesResponse.error ? [] : sublinesResponse.data ?? []);

    // Si es admin con programa, obtener el nombre del programa para mostrarlo
    if (adminProgramId !== null) {
      const { data: progData } = await supabase
        .from('programs')
        .select('name')
        .eq('program_id', adminProgramId)
        .maybeSingle();
      if (progData?.name) setAdminProgramName(progData.name);
    }

    setLoading(false);
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

      return matchesText && matchesStatus && matchesModality && matchesYear;
    });
  }, [filters, projects]);

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
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('users')
        .select('user_id, full_name, email')
        .eq('email', email)
        .maybeSingle();

      if (error || !data) {
        setFormError('Usuario no encontrado. Asegúrate de que el compañero ya se haya registrado en el sistema.');
      } else {
        setFormData(prev => ({
          ...prev,
          coauthors: [...prev.coauthors, { id: data.user_id, name: data.full_name, email: data.email }]
        }));
        setNewCoauthorEmail('');
      }
    } catch (err) {
      setFormError('Error al verificar el correo.');
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
    // Solo auto-generar en modo creación si hay una línea seleccionada
    if (editProjectId || !formData.lineId) return;

    let isMounted = true;

    const generateCode = async () => {
      setIsGeneratingCode(true);
      try {
        const line = lines.find((l) => String(l.research_line_id) === String(formData.lineId));
        const prefix = generatePrefix(line?.name);

        const supabase = getSupabaseClient();
        
        // Consultar códigos que empiecen con el prefijo
        const { data } = await supabase
          .from('projects')
          .select('code')
          .ilike('code', `${prefix}-%`);

        let maxNum = 0;
        if (data && data.length > 0) {
          data.forEach(row => {
            if (!row.code) return;
            const parts = row.code.split('-');
            if (parts.length > 1) {
              const num = parseInt(parts[1], 10);
              if (!isNaN(num) && num > maxNum) {
                maxNum = num;
              }
            }
          });
        }
        
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

    return () => {
      isMounted = false;
    };
  }, [formData.lineId, editProjectId, lines]);

  const handleSaveProject = async (event) => {
    event.preventDefault();

    if (!hasSupabaseConfig) {
      setFormError('Supabase no esta configurado.');
      return;
    }

    if (!formData.title.trim()) {
      setFormError('El titulo es obligatorio.');
      return;
    }

    if (formData.title.trim().length > 255) {
      setFormError('El título es demasiado largo (máximo 255 caracteres). Si necesitas más, debes cambiar la columna "title" a tipo TEXT en Supabase.');
      return;
    }

    if (formData.letterLink.trim() && formData.letterLink.trim().length > 255) {
      setFormError('El enlace de la carta es demasiado largo (máximo 255 caracteres). Acórtalo o cambia la columna a tipo TEXT en Supabase.');
      return;
    }

    if (!formData.statusId || !formData.modalityId) {
      setFormError('Selecciona estado y modalidad.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    const supabase = getSupabaseClient();
    const payload = {
      title: formData.title.trim(),
      code: formData.code.trim() || null,
      status_id: Number(formData.statusId) || null,
      modality_id: Number(formData.modalityId) || null,
      research_line_id: formData.lineId ? Number(formData.lineId) : null,
      research_subline_id: formData.sublineId ? Number(formData.sublineId) : null,
      letter_link: formData.letterLink.trim() || null,
    };

    if (editProjectId) {
      // Usamos select() para confirmar que RLS permitió actualizar la fila
      const { data: updatedData, error: updateError } = await supabase
        .from('projects')
        .update(payload)
        .eq('project_id', editProjectId)
        .select('project_id');

      if (updateError || !updatedData || updatedData.length === 0) {
        console.error('Update Error:', updateError);
        const errMsg = updateError?.message || 'Bloqueado por RLS (Filas actualizadas: 0)';
        setFormError(`No fue posible actualizar: ${errMsg}`);
        setSubmitting(false);
        return;
      }

      // Intentar guardar en el historial
      if (user?.id) {
        const { data: histData } = await supabase.from('histories').insert({
          description: 'Proyecto actualizado',
          change_type: 'Actualizacion',
          modified_field: 'Varios',
          // No tenemos un campo 'changed_by' en la estructura que vimos, lo omitimos si da error, pero dejemos lo basico
        }).select('history_id').single();

        if (histData?.history_id) {
          await supabase.from('project_histories').insert({
            project_id: editProjectId,
            history_id: histData.history_id
          });
        }
      }

      // Edición de co-autores
      if (editProjectId) {
        const { data: currentCoauthors } = await supabase
          .from('user_projects')
          .select('user_id')
          .eq('project_id', editProjectId);
          
        const currentIds = (currentCoauthors || []).map(c => c.user_id);
        const newIds = formData.coauthors.map(c => c.id);
        
        // Mantener al usuario actual para no auto-eliminarse por accidente si es el dueño
        if (user?.id && !newIds.includes(user.id)) {
           newIds.push(user.id);
        }

        const idsToAdd = newIds.filter(id => !currentIds.includes(id));
        const idsToRemove = currentIds.filter(id => !newIds.includes(id));

        const addResults = await Promise.all(
          idsToAdd.map((id) => {
            const role = String(id) === String(user?.id) ? 'autor' : 'coautor';
            return supabase.from('user_projects').insert({
              project_id: editProjectId,
              user_id: id,
              project_role: role,
            });
          }),
        );

        const addErrors = addResults
          .map((res, idx) => ({ res, id: idsToAdd[idx] }))
          .filter(({ res }) => res?.error)
          .map(({ res, id }) => `usuario ${id}: ${res.error.message}`);

        if (addErrors.length > 0) {
          console.warn('Errores al agregar co-autores en edición:', addErrors);
          setFormError(
            `Se actualizó el proyecto, pero no fue posible asignar ${addErrors.length} participante(s): ${addErrors.join(' | ')}`,
          );
        }

        if (idsToRemove.length > 0) {
          const { error: removeError } = await supabase
            .from('user_projects')
            .delete()
            .eq('project_id', editProjectId)
            .in('user_id', idsToRemove);

          if (removeError) {
            console.warn('Posible restricción RLS al eliminar co-autor:', removeError.message);
            setFormError(
              (prev) => prev
                ? `${prev} | No se pudieron retirar algunos participantes: ${removeError.message}`
                : `No se pudieron retirar algunos participantes: ${removeError.message}`,
            );
          }
        }
      }

      setFormSuccess('Proyecto actualizado correctamente.');
    } else {
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert(payload)
        .select('project_id')
        .single();

      if (insertError) {
        console.error('Insert Error:', insertError);
        setFormError(`No fue posible crear el proyecto: ${insertError.message}`);
        setSubmitting(false);
        return;
      }

      // Vincular el proyecto al usuario actual y co-autores en user_projects
      if (data?.project_id) {
        if (user?.id) {
          const { error: ownerError } = await supabase.from('user_projects').insert({
            project_id: data.project_id,
            user_id: user.id,
            project_role: 'autor',
          });

          if (ownerError) {
            console.error('Error al vincular autor principal:', ownerError);
            setFormError(`El proyecto se creó, pero no se pudo vincular al autor principal: ${ownerError.message}`);
            setSubmitting(false);
            return;
          }
        }

        if (formData.coauthors.length > 0) {
          const coauthorResults = await Promise.all(
            formData.coauthors.map((coauthor) =>
              supabase.from('user_projects').insert({
                project_id: data.project_id,
                user_id: coauthor.id,
                project_role: 'coautor',
              }),
            ),
          );

          const coauthorErrors = coauthorResults
            .map((result, idx) => ({ result, coauthor: formData.coauthors[idx] }))
            .filter(({ result }) => result.error)
            .map(({ result, coauthor }) => `${coauthor.email}: ${result.error.message}`);

          if (coauthorErrors.length > 0) {
            console.error('Errores al insertar co-autores:', coauthorErrors);
            setFormSuccess(
              `Proyecto creado correctamente. ${coauthorErrors.length} coautor(es) no se pudieron asignar por permisos de base de datos.`,
            );
            setSubmitting(false);
            setTimeout(() => {
              handleCloseForm();
              loadData();
            }, 2200);
            return;
          }
        }
      }

      setFormSuccess('Proyecto creado correctamente con todos sus autores.');
    }

    setTimeout(() => {
      handleCloseForm();
      loadData();
    }, 1500);
    setSubmitting(false);
  };

  return (
    <>
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
                  onClick={() => setShowCreateModal(true)}
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

      <style>{`
        .projects-page {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .projects-hero {
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), transparent 58%),
            var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-xl);
          padding: 24px 26px;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .projects-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .section-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--accent-primary);
          font-weight: 700;
          margin-bottom: 8px;
        }

        .prog-filter-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 10px;
          padding: 5px 12px;
          background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent-primary) 30%, var(--border-color));
          border-radius: 999px;
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .prog-filter-badge strong { color: var(--accent-primary); }
        .prog-filter-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-primary); flex-shrink: 0; }

        .section-title {
          font-family: var(--font-display);
          font-size: 1.55rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
          line-height: 1.12;
        }

        .section-subtitle {
          color: var(--text-secondary);
          font-size: 0.92rem;
          margin-top: 6px;
          line-height: 1.6;
        }

        .projects-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .projects-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .meta-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: var(--shadow-sm);
        }

        .meta-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }

        .meta-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        /* ── FIELD BASE STYLES ───────────────────────────────── */
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .field-input {
          width: 100%;
          padding: 10px 13px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          background: var(--bg-secondary);
          font-size: 0.88rem;
          font-family: var(--font-body);
          color: var(--text-primary);
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
          outline: none;
        }

        .field-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 14%, transparent);
        }

        .field-input:disabled {
          background: var(--bg-primary);
          color: var(--text-muted);
          cursor: not-allowed;
          opacity: 0.65;
        }

        .select-wrap {
          position: relative;
        }

        .field-select {
          appearance: none;
          padding-right: 34px;
          cursor: pointer;
        }

        .select-chevron {
          position: absolute;
          right: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        /* ── FORM CARD ─────────────────────────────────────────── */
        .form-card {
          background: var(--bg-card);
          border: 1.5px solid color-mix(in srgb, var(--accent-primary) 28%, var(--border-color));
          border-radius: var(--border-radius-lg);
          padding: 22px 24px;
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-primary) 6%, transparent),
                      var(--shadow-sm);
          animation: fadeIn 0.25s ease;
        }

        .form-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .form-header-icon {
          width: 38px;
          height: 38px;
          background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
          color: var(--accent-primary);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .form-header h3 {
          margin: 0 0 3px;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .form-header p {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .form-alert {
          margin-top: 14px;
          padding: 10px 12px;
          border-radius: var(--border-radius-sm);
          border: 1px solid color-mix(in srgb, var(--accent-primary) 40%, var(--border-color));
          background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
          color: var(--text-primary);
          font-size: 0.82rem;
        }

        .form-alert--error {
          border-color: color-mix(in srgb, var(--accent-danger) 40%, var(--border-color));
          background: color-mix(in srgb, var(--accent-danger) 12%, transparent);
          color: var(--accent-danger);
        }

        .form-grid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .form-grid .field-input:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--accent-primary) 45%, transparent);
          outline-offset: 1px;
        }

        .form-span {
          grid-column: span 2;
        }

        .form-actions {
          grid-column: span 2;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 6px;
        }

        .page-error {
          padding: 12px 14px;
          border-radius: var(--border-radius-sm);
          border: 1px solid color-mix(in srgb, var(--accent-danger) 30%, var(--border-color));
          background: color-mix(in srgb, var(--accent-danger) 12%, transparent);
          color: var(--accent-danger);
          font-size: 0.85rem;
        }

        .filters-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          padding: 18px 20px;
          box-shadow: var(--shadow-sm);
        }

        .filters-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .filters-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .filters-count {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .filters-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .projects-content {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
          gap: 18px;
        }

        .table-wrap {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          box-shadow: var(--shadow-sm);
          overflow-x: auto;
        }

        .table {
          width: 100%;
          min-width: 640px;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .table th {
          padding: 12px 18px;
          text-align: left;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
        }

        .table td {
          padding: 14px 18px;
          vertical-align: top;
        }

        .table-row {
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
        }

        .table-row:hover {
          background: color-mix(in srgb, var(--accent-primary) 6%, transparent);
        }

        .table-row--active {
          background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .project-title {
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .project-meta {
          color: var(--text-muted);
          font-size: 0.75rem;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 600;
          background: color-mix(in srgb, var(--accent-primary) 18%, transparent);
          color: var(--text-primary);
        }

        .row-actions {
          display: flex;
          gap: 8px;
        }

        .icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .icon-btn:hover {
          color: var(--text-primary);
          border-color: color-mix(in srgb, var(--accent-primary) 30%, var(--border-color));
        }

        .icon-btn.danger {
          color: var(--accent-danger);
        }

        .table-empty {
          padding: 32px 20px !important;
          text-align: center;
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .table-wrap {
            overflow: visible;
          }

          .table {
            min-width: 0;
            display: block;
          }

          .table thead {
            display: none;
          }

          .table tbody {
            display: grid;
            gap: 12px;
          }

          .table-row {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
            padding: 14px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-lg);
            background: var(--bg-card);
            cursor: default;
          }

          .table td {
            display: grid;
            grid-template-columns: 120px 1fr;
            gap: 8px;
            padding: 0;
            align-items: start;
          }

          .table td::before {
            content: attr(data-label);
            font-size: 0.68rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-muted);
            padding-top: 3px;
          }

          .table-title {
            font-size: 0.9rem;
          }

          .project-title {
            margin-bottom: 2px;
            font-size: 0.92rem;
          }

          .project-meta {
            white-space: normal;
            line-height: 1.45;
          }

          .row-actions {
            justify-content: flex-start;
            flex-wrap: wrap;
          }

          .row-actions .btn {
            width: 100%;
            justify-content: center;
          }

          .table-empty {
            display: block;
            padding: 24px 14px !important;
          }
        }

        .project-detail {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .detail-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          padding: 18px;
          box-shadow: var(--shadow-sm);
        }

        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .detail-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }

        .detail-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 6px 0 4px;
        }

        .detail-code {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .detail-key {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }

        .detail-value {
          display: block;
          font-weight: 600;
          color: var(--text-primary);
          margin-top: 4px;
        }

        .detail-description {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 16px;
        }

        .detail-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .detail-history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .history-empty {
          font-size: 0.8rem;
          color: var(--text-muted);
          padding: 8px 4px;
        }

        .history-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          border-radius: var(--border-radius-md);
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
        }

        .history-title {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 0.85rem;
          margin-bottom: 4px;
        }

        .history-detail {
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .history-date {
          font-size: 0.72rem;
          color: var(--text-muted);
          white-space: nowrap;
        }

        @media (max-width: 1100px) {
          .filters-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .projects-content {
            grid-template-columns: 1fr;
          }

          .projects-meta {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .projects-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .filters-grid {
            grid-template-columns: 1fr;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-span,
          .form-actions {
            grid-column: span 1;
          }

          .projects-meta {
            grid-template-columns: 1fr;
          }

          .projects-hero {
            padding: 18px 16px;
            gap: 14px;
          }

          .filters-card {
            padding: 16px;
          }
        }

        @media (max-width: 480px) {
          .projects-page {
            gap: 16px;
          }

          .projects-hero {
            border-radius: var(--border-radius-lg);
          }

          .filters-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .filters-count {
            font-size: 0.72rem;
          }

          .table td {
            grid-template-columns: 1fr;
          }

          .table td::before {
            margin-bottom: 0;
          }
        }

        /* ── MODALES ─────────────────────────────────────────── */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(4px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.18s ease;
        }

        .modal-box {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-xl);
          box-shadow: var(--shadow-lg);
          width: 100%;
          max-width: 560px;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.22s ease;
          overflow: hidden;
        }

        .modal-box--lg {
          max-width: 720px;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .modal-backdrop {
            position: absolute;
            left: 0;
            top: 0;
            background: transparent;
            padding: 0;
            margin: 0;
            width: 100%;
            height: 100%;
          }
          .modal-box, .modal-box * {
            visibility: visible;
          }
          .modal-box {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            box-shadow: none;
            border: none;
            border-radius: 0;
          }
          .modal-footer, .modal-close {
            display: none !important;
          }
          .modal-body {
            overflow: visible;
          }
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 24px 18px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .modal-eyebrow {
          display: block;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--accent-primary);
          margin-bottom: 4px;
        }

        .modal-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin: 0 0 4px;
          line-height: 1.3;
        }

        .modal-code {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .modal-close {
          background: none;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-muted);
          flex-shrink: 0;
          transition: all var(--transition-fast);
        }

        .modal-close:hover {
          color: var(--text-primary);
          background: var(--bg-primary);
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .modal-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .badge--muted {
          background: var(--bg-primary);
          color: var(--text-secondary);
        }

        .badge--owned {
          background: color-mix(in srgb, var(--accent-success) 14%, transparent);
          color: var(--accent-success);
        }

        .modal-info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .modal-info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px;
          background: var(--bg-primary);
          border-radius: var(--border-radius-sm);
          border: 1px solid var(--border-color);
        }

        .modal-info-key {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }

        .modal-info-val {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .modal-link-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: var(--bg-primary);
          border-radius: var(--border-radius-sm);
          border: 1px solid var(--border-color);
        }

        .modal-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--accent-primary);
          text-decoration: none;
          transition: opacity var(--transition-fast);
        }

        .modal-link:hover { opacity: 0.75; }

        .modal-footer {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 24px;
          border-top: 1px solid var(--border-color);
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        .modal-close-btn {
          margin-left: auto;
          background: none;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          padding: 8px 16px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .modal-close-btn:hover {
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        /* Timeline (historial modal) */
        .history-timeline {
          display: flex;
          flex-direction: column;
          gap: 0;
          position: relative;
          padding-left: 20px;
        }

        .history-timeline::before {
          content: '';
          position: absolute;
          left: 7px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--border-color);
        }

        .timeline-item {
          display: flex;
          gap: 14px;
          padding-bottom: 18px;
          position: relative;
        }

        .timeline-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--accent-primary);
          border: 2px solid var(--bg-card);
          flex-shrink: 0;
          margin-top: 4px;
          position: absolute;
          left: -17px;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 30%, transparent);
        }

        .timeline-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .timeline-title {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .timeline-detail {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-family: monospace;
        }

        .timeline-date {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .history-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.85rem;
          gap: 8px;
        }

        @media (max-width: 600px) {
          .modal-info-grid { grid-template-columns: 1fr; }
          .modal-footer { flex-direction: column; }
          .modal-close-btn { margin-left: 0; width: 100%; }
        }
      `}</style>

    </DashboardLayout>

    {showCreateModal && (
      <CreateProjectModal
        statuses={statuses}
        modalities={modalities}
        lines={lines}
        sublines={sublines}
        onClose={() => setShowCreateModal(false)}
        onSaved={() => { setShowCreateModal(false); loadData(); }}
        user={user}
      />
    )}
    </>
  );
}





export function UsuariosPage() {
  return (
    <DashboardLayout title="Usuarios" subtitle="Gestion de cuentas y permisos">
      <div className="page-coming">
        <div className="page-coming-icon">
          <Users size={36} />
        </div>
        <h2>Gestion de Usuarios</h2>
        <p>
          Los usuarios, roles y permisos se cargaran desde la base de datos cuando la capa de
          administracion este integrada.
        </p>
        <Button variant="primary">Administrar usuarios</Button>
      </div>
      <Style />
    </DashboardLayout>
  );
}

export function AjustesPage() {
  return (
    <DashboardLayout title="Ajustes" subtitle="Configuracion de la plataforma">
      <div className="page-coming">
        <div className="page-coming-icon">
          <Settings size={36} />
        </div>
        <h2>Configuracion</h2>
        <p>
          La configuracion funcional del sistema se conectara cuando tengamos persistencia real y
          servicios disponibles.
        </p>
        <Button variant="primary">Abrir configuracion</Button>
      </div>
      <Style />
    </DashboardLayout>
  );
}

function Style() {
  return (
    <style>{`
      .page-coming {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        text-align: center;
        padding: 80px 40px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-xl);
        box-shadow: var(--shadow-sm);
      }

      .page-coming--compact {
        padding: 56px 32px;
      }

      .page-coming-icon {
        width: 72px;
        height: 72px;
        background: var(--bg-primary);
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-primary);
      }

      .page-coming h2 {
        font-family: var(--font-display);
        font-size: 1.5rem;
        color: var(--text-primary);
        letter-spacing: -0.02em;
      }

      .page-coming p {
        max-width: 480px;
        color: var(--text-secondary);
        font-size: 0.9rem;
        line-height: 1.7;
      }

      .page-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
      }

      @media (max-width: 520px) {
        .page-coming {
          padding: 48px 24px;
        }

        .page-coming--compact {
          padding: 40px 20px;
        }

        .page-coming h2 {
          font-size: 1.28rem;
        }

        .page-actions {
          width: 100%;
          flex-direction: column;
        }

        .page-actions > * {
          width: 100%;
        }
      }
    `}</style>
  );
}