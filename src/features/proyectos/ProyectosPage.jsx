import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, BookOpen, ChevronDown, Download, ExternalLink, Eye, FilePlus2, Filter, History, Pencil,
  Settings, Trash2, Upload, Users, X,
} from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import { getSupabaseClient } from '../../lib/supabase/client';
import EditProjectModal from './EditProjectModal'; // ajusta la ruta
import CrearProyecto from './CrearProyecto';
import {
  hasSupabaseConfig,
  hasSupabaseConfigAttempt,
  supabaseConfigError,
} from '../../lib/supabase/config';
import { generatePrefix } from './generatePrefix';
import './ProyectosPage.css';

export function ProyectosPage() {
  const { user } = useAuth();
  const isStudent = user?.role?.toLowerCase() === 'estudiante';
  const isDocente = user?.role?.toLowerCase() === 'docente';
  const isLimitedUser = isStudent || isDocente;

  // Si el usuario es administrador y tiene un programa asignado, filtrar por ese programa
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
  const [ownedProjectIds, setOwnedProjectIds] = useState(new Set());
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
          myRole: (row.user_projects ?? []).find(p => p.user_id === user?.id)?.project_role || null,
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
