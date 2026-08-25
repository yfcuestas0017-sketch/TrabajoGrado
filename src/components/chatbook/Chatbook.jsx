import { useEffect, useRef, useState } from 'react';
import { Bot, CalendarDays, ChevronDown, CircleHelp, FolderGit2, LineChart, Send, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import './Chatbook.css';

const ROLE_CATEGORIES = {
  estudiante: {
    fechas: {
      label: 'Fechas',
      icon: CalendarDays,
      questions: [
        '¿Cuándo inicia mi proyecto?',
        '¿Cuándo termina mi proyecto?',
        '¿Cuánto tiempo dura mi proyecto?',
        '¿Cuánto falta para que termine mi proyecto?',
        '¿Cuáles son las fechas de mis proyectos?',
        '¿Cuál de mis proyectos termina primero?',
        '¿Cuál de mis proyectos está próximo a terminar?',
      ],
    },
    estados: {
      label: 'Estados',
      icon: CircleHelp,
      questions: [
        '¿Cuál es el estado de mi proyecto?',
        '¿Cuál es el estado de mis proyectos?',
        '¿Qué significa el estado de mi proyecto?',
        '¿Qué proyectos míos están en ejecución?',
        '¿Tengo algún proyecto terminado?',
      ],
    },
    proyectos: {
      label: 'Proyectos',
      icon: FolderGit2,
      questions: [
        '¿Cuáles son mis proyectos?',
        '¿Qué proyectos están disponibles?',
        'Busca proyectos relacionados con mi línea.',
        'Busca proyectos sobre inteligencia artificial.',
        'Muéstrame proyectos similares.',
      ],
    },
    lineas: {
      label: 'Líneas',
      icon: LineChart,
      questions: [
        '¿Cuál es mi línea de investigación?',
        '¿Cuál es la sublínea de mi proyecto?',
        '¿Qué proyectos existen en mi línea?',
        '¿Qué otras líneas existen?',
      ],
    },
    docentes: {
      label: 'Docentes',
      icon: Users,
      questions: [
        '¿Quién es mi docente asesor?',
        '¿Qué docente está asociado a mi proyecto?',
        '¿Qué docentes pertenecen a mi línea?',
      ],
    },
  },
  docente: {
    fechas: {
      label: 'Fechas',
      icon: CalendarDays,
      questions: [
        '¿Cuándo terminan los proyectos que asesoro?',
        '¿Qué proyectos están próximos a terminar?',
        '¿Cuál es la fecha de inicio de este proyecto?',
        '¿Cuál es la fecha de finalización?',
        'Muéstrame las fechas de los proyectos que asesoro.',
      ],
    },
    estados: {
      label: 'Estados',
      icon: CircleHelp,
      questions: [
        '¿Cuál es el estado de los proyectos que asesoro?',
        '¿Qué proyectos están en ejecución?',
        '¿Qué proyectos están terminados?',
        '¿Qué proyectos están pendientes?',
        '¿Cuántos proyectos tengo en cada estado?',
      ],
    },
    proyectos: {
      label: 'Proyectos',
      icon: FolderGit2,
      questions: [
        '¿Qué proyectos tengo asignados?',
        '¿Qué proyectos asesoro?',
        '¿Qué proyectos existen en esta línea?',
        'Busca proyectos relacionados con esta temática.',
      ],
    },
    lineas: {
      label: 'Líneas',
      icon: LineChart,
      questions: [
        '¿A qué línea pertenece este proyecto?',
        '¿Qué proyectos existen en mi línea?',
        '¿Qué sublíneas pertenecen a esta línea?',
        '¿Qué docentes pertenecen a esta línea?',
      ],
    },
    docentes: {
      label: 'Docentes',
      icon: Users,
      questions: [
        '¿Qué proyectos tengo asignados?',
        '¿Qué estudiantes están asociados a mis proyectos?',
        '¿Qué docentes pertenecen a esta línea?',
      ],
    },
  },
  admin: {
    fechas: {
      label: 'Fechas',
      icon: CalendarDays,
      questions: [
        '¿Qué proyectos están próximos a terminar?',
        '¿Qué proyectos comenzaron recientemente?',
        '¿Cuántos proyectos terminan este mes?',
        '¿Cuáles son las fechas de los proyectos?',
        'Muéstrame proyectos por fecha de finalización.',
      ],
    },
    estados: {
      label: 'Estados',
      icon: CircleHelp,
      questions: [
        '¿Cuántos proyectos existen por estado?',
        '¿Qué proyectos están en ejecución?',
        '¿Qué proyectos están terminados?',
        '¿Qué proyectos están pendientes?',
        '¿Qué proyectos están disponibles?',
        '¿Cuántos proyectos existen actualmente?',
      ],
    },
    proyectos: {
      label: 'Proyectos',
      icon: FolderGit2,
      questions: [
        'Muéstrame todos los proyectos.',
        '¿Cuántos proyectos existen?',
        '¿Qué proyectos están disponibles?',
        'Busca proyectos por línea.',
        'Busca proyectos por estado.',
        'Busca proyectos por modalidad.',
      ],
    },
    lineas: {
      label: 'Líneas',
      icon: LineChart,
      questions: [
        '¿Qué líneas de investigación existen?',
        '¿Cuántos proyectos tiene cada línea?',
        '¿Qué sublíneas existen?',
        '¿Qué docentes pertenecen a cada línea?',
        '¿Qué proyectos están asociados a cada línea?',
      ],
    },
    docentes: {
      label: 'Docentes',
      icon: Users,
      questions: [
        '¿Qué docentes existen?',
        '¿Qué docentes pertenecen a cada línea?',
        '¿Qué proyectos tiene asignado cada docente?',
        '¿Qué docentes tienen proyectos asociados?',
      ],
    },
  },
};

function normalizeUserRole(role) {
  const norm = String(role || '').toLowerCase();
  if (norm.includes('admin')) return 'admin';
  if (norm.includes('docent')) return 'docente';
  if (norm.includes('estudiant')) return 'estudiante';
  return 'estudiante';
}

function Avatar({ small = false }) {
  return <img className={`chatbook-avatar${small ? ' chatbook-avatar--small' : ''}`} src="/chatbook/gato-cesmag.png" alt="Mascota de Chatbook" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/Escudos.png'; }} />;
}

function ProjectResult({ project, onSelect, isStudent }) {
  const metaParts = [project.code || 'Sin código'];
  if (!isStudent && project.status) {
    metaParts.push(project.status);
  }
  if (project.line) {
    metaParts.push(project.line);
  }

  return (
    <button type="button" className="chatbook-project" onClick={() => onSelect(`¿Cuál es la información del proyecto ${project.code || project.title}?`)}>
      <span className="chatbook-project-title">{project.title}</span>
      <span className="chatbook-project-meta">{metaParts.join(' · ')}</span>
      {project.authors?.length > 0 && <span className="chatbook-project-meta">Autores: {project.authors.map((person) => person.name).join(', ')}</span>}
    </button>
  );
}

function LineResult({ line, onSelect, isStudent }) {
  return (
    <article className="chatbook-line-result">
      <strong>{line.name}</strong>
      {line.description && <p>{line.description}</p>}
      {line.sublines?.length > 0 && <span><b>Sublíneas:</b> {line.sublines.map((subline) => subline.name).join(', ')}</span>}
      {!isStudent && line.teachers?.length > 0 && <span><b>Docentes:</b> {line.teachers.map((teacher) => teacher.name).join(', ')}</span>}
      {!isStudent && (!line.teachers || line.teachers.length === 0) && <span><b>Docentes:</b> No encuentro esta información registrada actualmente en el sistema.</span>}
      <button type="button" onClick={() => onSelect(`¿Qué proyectos existen en la línea ${line.name}?`)}>Ver proyectos de esta línea</button>
    </article>
  );
}

function StatsResult({ stats }) {
  return (
    <div className="chatbook-stats-results">
      {stats.map((stat, i) => {
        const isNumeric = typeof stat.value === 'number';
        return (
          <div className={`chatbook-stat-card${isNumeric ? '' : ' chatbook-stat-card--text'}`} key={i}>
            {isNumeric && (
              <span className="chatbook-stat-value">{stat.value}</span>
            )}
            <div className="chatbook-stat-body">
              <span className="chatbook-stat-label">{stat.label}</span>
              {stat.sublabel && (
                <span className="chatbook-stat-sublabel">{stat.sublabel}</span>
              )}
              {!isNumeric && stat.value && (
                <span className="chatbook-stat-line">{stat.value}</span>
              )}
            </div>
            {stat.items?.length > 0 && (
              <ul className="chatbook-stat-items">
                {stat.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TeacherResult({ teacherProfile, onSelect }) {
  if (!teacherProfile) return null;
  const t = teacherProfile.teacher || {};
  const lines = teacherProfile.lines || [];
  const sublines = teacherProfile.sublines || [];
  const projects = teacherProfile.projects || [];
  const asesorCount = teacherProfile.asesorProjects?.length || 0;
  const juradoCount = teacherProfile.juradoProjects?.length || 0;
  const total = teacherProfile.totalProjects || projects.length || 0;

  return (
    <div className="chatbook-teacher-card">
      <div className="chatbook-teacher-head">
        <strong className="chatbook-teacher-name">{t.full_name || 'Docente'}</strong>
        {t.email && <span className="chatbook-teacher-email">{t.email}</span>}
      </div>

      <div className="chatbook-teacher-info-grid">
        {lines.length > 0 && (
          <div className="chatbook-teacher-field">
            <span className="chatbook-field-label">Línea de investigación:</span>
            <span className="chatbook-field-value">{lines.join(', ')}</span>
          </div>
        )}
        {sublines.length > 0 && (
          <div className="chatbook-teacher-field">
            <span className="chatbook-field-label">Sublínea:</span>
            <span className="chatbook-field-value">{sublines.join(', ')}</span>
          </div>
        )}
        <div className="chatbook-teacher-field">
          <span className="chatbook-field-label">Participación en proyectos:</span>
          <span className="chatbook-field-value">
            {total} proyecto(s) {total > 0 ? `(${asesorCount} como asesor, ${juradoCount} como jurado)` : ''}
          </span>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="chatbook-teacher-projects-wrap">
          <span className="chatbook-teacher-subheading">Proyectos asociados:</span>
          <div className="chatbook-results">
            {projects.map((p) => (
              <ProjectResult key={p.id || p.code} project={p} onSelect={onSelect} isStudent={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectDetailResult({ project }) {
  if (!project) return null;
  return (
    <div className="chatbook-detail-card">
      <div className="chatbook-detail-header">
        <span className="chatbook-project-badge">{project.code || 'PROYECTO'}</span>
        {project.status && <span className="chatbook-status-badge">{project.status}</span>}
      </div>
      <strong className="chatbook-detail-title">{project.title}</strong>
      <div className="chatbook-detail-grid">
        {project.line && <div><b>Línea:</b> {project.line}</div>}
        {project.subline && <div><b>Sublínea:</b> {project.subline}</div>}
        {project.modality && <div><b>Modalidad:</b> {project.modality}</div>}
        {project.authors?.length > 0 && (
          <div><b>Autores:</b> {project.authors.map((a) => a.name).join(', ')}</div>
        )}
        {project.teachers?.length > 0 && (
          <div><b>Docentes:</b> {project.teachers.map((t) => `${t.name}${t.role ? ` (${t.role})` : ''}`).join(', ')}</div>
        )}
        {project.createdAt && (
          <div><b>Fecha inicio:</b> {new Date(project.createdAt).toLocaleDateString('es-CO')}</div>
        )}
        {project.finishedAt && (
          <div><b>Fecha finalización:</b> {new Date(project.finishedAt).toLocaleDateString('es-CO')}</div>
        )}
      </div>
    </div>
  );
}

export default function Chatbook() {
  const { user } = useAuth();
  const roleKey = normalizeUserRole(user?.role);
  const isStudent = roleKey === 'estudiante';
  const programName = user?.programName || 'Universidad CESMAG';

  const categories = ROLE_CATEGORIES[roleKey] || ROLE_CATEGORIES.estudiante;
  const [activeCategory, setActiveCategory] = useState('proyectos');

  const welcomeText = isStudent
    ? `Hola. Soy Chatbook, tu asistente virtual para la gestión de proyectos de grado en ${programName}. Puedo orientarte en fechas, estados, proyectos, líneas y tu docente asesor. ¿Qué deseas consultar hoy?`
    : roleKey === 'docente'
      ? `Hola. Soy Chatbook, tu asistente virtual para la gestión de proyectos de grado en ${programName}. Puedes consultar los proyectos que asesoras, fechas de entrega, estados, estudiantes y líneas de investigación. ¿En qué te puedo colaborar?`
      : `Hola. Soy Chatbook, tu asistente de gestión de proyectos de grado para ${programName}. Puedo ayudarte con estadísticas, proyectos por estado, fechas de finalización, líneas de investigación y docentes. ¿Qué deseas consultar?`;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      from: 'assistant',
      text: welcomeText,
    },
  ]);
  const bodyRef = useRef(null);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [{ id: 'welcome', from: 'assistant', text: welcomeText }];
      }
      return prev;
    });
  }, [welcomeText]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading]);

  const ask = async (prompt) => {
    const text = String(prompt || '').trim();
    if (!text || loading) return;
    setInput('');
    setMessages((current) => [...current, { id: `${Date.now()}-user`, from: 'user', text }]);
    setLoading(true);
    try {
      const result = await api.queryChatbook(user?.id, text);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          from: 'assistant',
          text: result.message,
          projects: result.projects,
          lines: result.lines,
          stats: result.stats,
          teacher: result.teacher,
          projectDetail: result.projectDetail,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          from: 'assistant',
          text: error.message || 'Se presentó un inconveniente al procesar tu consulta. Intenta nuevamente.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const currentQuestions = categories[activeCategory]?.questions || [];

  return (
    <>
      <button type="button" className="chatbook-fab" onClick={() => setOpen(true)} aria-label="Abrir Chatbook" title="Abrir Chatbook">
        <Avatar />
        <span className="chatbook-fab-pulse" />
      </button>

      {open && (
        <section className="chatbook-panel" aria-label="Chatbook">
          <header className="chatbook-header">
            <div className="chatbook-heading">
              <Avatar small />
              <div>
                <strong>Chatbook</strong>
                <span>{programName} · {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Asistente Virtual'}</span>
              </div>
            </div>
            <button type="button" className="chatbook-icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar Chatbook">
              <ChevronDown size={19} />
            </button>
          </header>

          <div className="chatbook-body" ref={bodyRef}>
            {messages.map((message) => {
              const hasCustomCard =
                Boolean(message.teacher) ||
                Boolean(message.projectDetail) ||
                (Array.isArray(message.stats) && message.stats.length > 0) ||
                (Array.isArray(message.projects) && message.projects.length > 0) ||
                (Array.isArray(message.lines) && message.lines.length > 0);
              return (
                <div className={`chatbook-message chatbook-message--${message.from}`} key={message.id}>
                  {message.from === 'assistant' && <Avatar small />}
                  <div className="chatbook-bubble">
                    {!hasCustomCard && <p>{message.text}</p>}

                    {message.teacher && (
                      <TeacherResult teacherProfile={message.teacher} onSelect={ask} />
                    )}

                    {message.projectDetail && (
                      <ProjectDetailResult project={message.projectDetail} />
                    )}

                    {message.stats?.length > 0 && (
                      <StatsResult stats={message.stats} />
                    )}

                    {!message.teacher && !message.projectDetail && message.projects?.length > 0 && (
                      <div className="chatbook-results">
                        {message.projects.map((project) => (
                          <ProjectResult key={project.id || project.code} project={project} onSelect={ask} isStudent={isStudent} />
                        ))}
                      </div>
                    )}

                    {message.lines?.length > 0 && (
                      <div className="chatbook-line-results">
                        {message.lines.map((line) => (
                          <LineResult key={line.research_line_id} line={line} onSelect={ask} isStudent={isStudent} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="chatbook-message chatbook-message--assistant">
                <Avatar small />
                <div className="chatbook-bubble chatbook-loading">
                  <Bot size={15} /> Consultando base de datos...
                </div>
              </div>
            )}
          </div>

          <div className="chatbook-quick-section">
            <div className="chatbook-category-tabs" role="tablist" aria-label="Categorías de consulta rápida">
              {Object.entries(categories).map(([catKey, cat]) => {
                const Icon = cat.icon;
                const isActive = activeCategory === catKey;
                return (
                  <button
                    type="button"
                    key={catKey}
                    className={`chatbook-category-tab ${isActive ? 'chatbook-category-tab--active' : ''}`}
                    onClick={() => setActiveCategory(catKey)}
                    role="tab"
                    aria-selected={isActive}
                  >
                    <Icon size={13} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="chatbook-quick-questions">
              {currentQuestions.map((q) => (
                <button
                  type="button"
                  key={q}
                  className="chatbook-question-chip"
                  onClick={() => ask(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <form className="chatbook-input-row" onSubmit={(event) => { event.preventDefault(); ask(input); }}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escribe tu pregunta o consulta..."
              aria-label="Pregunta para Chatbook"
            />
            <button type="submit" aria-label="Enviar pregunta" disabled={loading || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}