import pool from '../server/db.js';

const CHATBOOK_NOT_FOUND = 'No encuentro esta información registrada actualmente en el sistema.';

function normalizeChatbookText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatDateCO(d) {
  if (!d) return 'Sin fecha registrada';
  try {
    return new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(d);
  }
}

function getRemainingTime(targetDate) {
  if (!targetDate) return 'Sin fecha límite definida';
  const now = new Date();
  const target = new Date(targetDate);
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Finalizó hace ${Math.abs(diffDays)} días (${formatDateCO(targetDate)})`;
  if (diffDays === 0) return `Termina hoy (${formatDateCO(targetDate)})`;
  if (diffDays <= 30) return `Faltan ${diffDays} días (${formatDateCO(targetDate)})`;
  const diffMonths = Math.floor(diffDays / 30);
  const remDays = diffDays % 30;
  return `Faltan aproximadamente ${diffMonths} mes(es)${remDays > 0 ? ` y ${remDays} días` : ''} (${formatDateCO(targetDate)})`;
}

function formatChatbookProject(row, isStudent = false) {
  const participants = row.participants || [];
  return {
    id: row.project_id,
    title: row.title,
    code: row.code,
    createdAt: isStudent ? null : row.created_at,
    finishedAt: isStudent ? null : row.finished_at,
    line: row.line_name,
    subline: row.subline_name,
    modality: row.modality_name,
    status: row.status_name,
    authors: participants.filter((person) => ['autor', 'coautor'].includes(String(person.role).toLowerCase())),
    teachers: participants.filter((person) => ['asesor', 'jurado', 'docente'].includes(String(person.role).toLowerCase())),
    participants,
  };
}

async function testTeacherAndAdmin() {
  const teacher = (await pool.query("SELECT user_id, full_name, program_id FROM public.users WHERE user_id = 'fa118804-f610-4e7b-bf4a-dfde93c06c89'")).rows[0];
  console.log('\n================ TESTING TEACHER:', teacher.full_name, '================');

  const teacherQuestions = [
    '¿Cuándo terminan los proyectos que asesoro?',
    '¿Qué proyectos están próximos a terminar?',
    '¿Cuál es la fecha de inicio de este proyecto?',
    '¿Cuál es la fecha de finalización?',
    'Muéstrame las fechas de los proyectos que asesoro.',
    '¿Cuál es el estado de los proyectos que asesoro?',
    '¿Qué proyectos están en ejecución?',
    '¿Qué proyectos están terminados?',
    '¿Qué proyectos están pendientes?',
    '¿Cuántos proyectos tengo en cada estado?',
    '¿Qué proyectos tengo asignados?',
    '¿Qué proyectos asesoro?',
    '¿Qué proyectos existen en esta línea?',
    '¿A qué línea pertenece este proyecto?',
    '¿Qué proyectos existen en mi línea?',
    '¿Qué sublíneas pertenecen a esta línea?',
    '¿Qué docentes pertenecen a esta línea?',
    '¿Qué estudiantes están asociados a mis proyectos?'
  ];

  const admin = (await pool.query("SELECT user_id, full_name, program_id FROM public.users WHERE user_id = 'c70cb1f0-227c-4d40-a73b-fdfd22273cdc'")).rows[0];
  console.log('\n================ TESTING ADMIN:', admin.full_name, '================');

  const adminQuestions = [
    '¿Qué proyectos están próximos a terminar?',
    '¿Qué proyectos comenzaron recientemente?',
    '¿Cuántos proyectos terminan este mes?',
    '¿Cuáles son las fechas de los proyectos?',
    'Muéstrame proyectos por fecha de finalización.',
    '¿Cuántos proyectos existen por estado?',
    '¿Qué proyectos están en ejecución?',
    '¿Qué proyectos están terminados?',
    '¿Qué proyectos están pendientes?',
    '¿Qué proyectos están disponibles?',
    '¿Cuántos proyectos existen actualmente?',
    'Muéstrame todos los proyectos.',
    '¿Cuántos proyectos existen?',
    'Busca proyectos por línea.',
    'Busca proyectos por estado.',
    'Busca proyectos por modalidad.',
    '¿Qué líneas de investigación existen?',
    '¿Cuántos proyectos tiene cada línea?',
    '¿Qué sublíneas existen?',
    '¿Qué docentes pertenecen a cada línea?',
    '¿Qué proyectos están asociados a cada línea?',
    '¿Qué docentes existen?',
    '¿Qué proyectos tiene asignado cada docente?',
    '¿Qué docentes tienen proyectos asociados?'
  ];

  console.log('Teacher questions count:', teacherQuestions.length);
  console.log('Admin questions count:', adminQuestions.length);

  await pool.end();
}

testTeacherAndAdmin().catch(console.error);
