import { useEffect, useRef, useState } from 'react';
import { Bot, CalendarDays, ChevronDown, CircleHelp, LineChart, ListFilter, Search, Send, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import './Chatbook.css';

const QUICK_QUESTIONS_DEFAULT = [
  { label: 'Banco de proyectos', icon: ListFilter, prompt: 'Muéstrame los proyectos disponibles.' },
  { label: 'Mis proyectos', icon: Search, prompt: 'Muéstrame mis proyectos.' },
  { label: 'Líneas', icon: LineChart, prompt: '¿Qué líneas de investigación existen?' },
  { label: 'Docentes', icon: Users, prompt: '¿Qué docentes están asociados a mis proyectos?' },
  { label: 'Fechas', icon: CalendarDays, prompt: '¿Cuándo terminan mis proyectos?' },
  { label: 'Estados', icon: CircleHelp, prompt: '¿Qué proyectos están disponibles?' },
];

const QUICK_QUESTIONS_STUDENT = [
  { label: 'Banco de proyectos', icon: ListFilter, prompt: 'Muéstrame los proyectos disponibles.' },
  { label: 'Mis proyectos', icon: Search, prompt: 'Muéstrame mis proyectos.' },
  { label: 'Líneas', icon: LineChart, prompt: '¿Qué líneas de investigación existen?' },
];

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

export default function Chatbook() {
  const { user } = useAuth();
  const isStudent = user?.role?.toLowerCase() === 'estudiante';

  const welcomeText = isStudent
    ? 'Hola. Soy Chatbook, tu asistente virtual para la gestión de proyectos de grado. Puedo ayudarte a consultar proyectos, explorar el Banco de Proyectos, líneas y sublíneas de investigación. ¿Qué deseas consultar?'
    : 'Hola. Soy Chatbook, tu asistente virtual para la gestión de proyectos de grado. Puedo ayudarte a consultar proyectos, explorar el Banco de Proyectos, líneas, sublíneas, docentes, fechas y estados. ¿Qué deseas consultar?';

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
      setMessages((current) => [...current, { id: `${Date.now()}-assistant`, from: 'assistant', text: result.message, projects: result.projects, lines: result.lines }]);
    } catch (error) {
      setMessages((current) => [...current, { id: `${Date.now()}-error`, from: 'assistant', text: error.message || 'Se presentó un inconveniente al procesar tu consulta. Intenta nuevamente.' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = isStudent ? QUICK_QUESTIONS_STUDENT : QUICK_QUESTIONS_DEFAULT;

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
                <span>Asistente Virtual para la Gestión de Proyectos de Grado</span>
              </div>
            </div>
            <button type="button" className="chatbook-icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar Chatbook">
              <ChevronDown size={19} />
            </button>
          </header>
          <div className="chatbook-body" ref={bodyRef}>
            {messages.map((message) => (
              <div className={`chatbook-message chatbook-message--${message.from}`} key={message.id}>
                {message.from === 'assistant' && <Avatar small />}
                <div className="chatbook-bubble">
                  <p>{message.text}</p>
                  {message.projects?.length > 0 && (
                    <div className="chatbook-results">
                      {message.projects.map((project) => (
                        <ProjectResult key={project.id} project={project} onSelect={ask} isStudent={isStudent} />
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
            ))}
            {loading && (
              <div className="chatbook-message chatbook-message--assistant">
                <Avatar small />
                <div className="chatbook-bubble chatbook-loading">
                  <Bot size={15} /> Consultando información...
                </div>
              </div>
            )}
          </div>
          <div className="chatbook-quick">
            {quickQuestions.map(({ label, icon: Icon, prompt }) => (
              <button type="button" key={label} onClick={() => ask(prompt)}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          <form className="chatbook-input-row" onSubmit={(event) => { event.preventDefault(); ask(input); }}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Escribe tu pregunta..." aria-label="Pregunta para Chatbook" />
            <button type="submit" aria-label="Enviar pregunta" disabled={loading || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}