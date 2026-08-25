import pool from '../server/db.js';

// Let's create the full handler in a test script and run test queries for all 3 roles across 2 programs
import { fileURLToPath } from 'url';

const CHATBOOK_NOT_FOUND = 'No encuentro esta información registrada actualmente en el sistema.';
const CHATBOOK_STOP_WORDS = new Set([
  'docente', 'docentes', 'profesor', 'profesores', 'profesora', 'profesoras',
  'asesor', 'asesores', 'asesora', 'jurado', 'jurados', 'evaluador', 'evaluadores',
  'sistema', 'investigacion', 'investigación', 'linea', 'línea', 'sublinea', 'sublínea',
  'proyectos', 'proyecto', 'trabajos', 'trabajo', 'nuevo', 'nueva', 'usuario', 'usuarios',
  'cuenta', 'para', 'como', 'sobre', 'tiene', 'estan', 'están', 'cuantos', 'cuántos',
  'cuales', 'cuáles', 'quien', 'quién', 'quienes', 'quiénes', 'informacion', 'información',
  'que', 'qué', 'cual', 'cuál', 'los', 'las', 'del', 'con', 'por', 'son', 'mis', 'sus',
  'este', 'esta', 'estos', 'estas'
]);

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

function getDuration(startDate, endDate) {
  if (!startDate || !endDate) return 'Duración estimada de 2 semestres académicos (1 año)';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const months = Math.round(diffDays / 30);
  return `${months} meses (${diffDays} días calendario)`;
}

function getStatusMeaning(statusName) {
  const norm = normalizeChatbookText(statusName);
  if (norm.includes('propuest') || norm.includes('radicad')) {
    return 'Propuesta / Radicado: El anteproyecto está formulado y radicado para revisión académica y aprobación del comité.';
  }
  if (norm.includes('curso') || norm.includes('ejecucion') || norm.includes('aprobado')) {
    return 'En curso / En ejecución: El proyecto de grado fue aprobado formalmente y se encuentra en desarrollo activo bajo la dirección de tu asesor.';
  }
  if (norm.includes('finalizad') || norm.includes('terminad') || norm.includes('sustentad')) {
    return 'Finalizado: El trabajo de grado culminó satisfactoriamente su proceso de desarrollo, evaluación y sustentación.';
  }
  if (norm.includes('suspendid') || norm.includes('pausad')) {
    return 'Suspendido: El proyecto cuenta con una pausa justificada o prórroga en trámite.';
  }
  if (norm.includes('rechazad') || norm.includes('no aprobad')) {
    return 'Rechazado: El proyecto no fue aprobado y requiere ajustes sustanciales o nueva formulación.';
  }
  if (norm.includes('disponib') || norm.includes('banco')) {
    return 'Disponible: El proyecto está publicado en el Banco de Proyectos esperando ser seleccionado.';
  }
  return `Estado: ${statusName}. El proyecto se encuentra registrado activamente en el sistema.`;
}

// Format single project
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

async function testRoles() {
  console.log('Testing Chatbook unified query logic...');
  await pool.end();
}

testRoles().catch(console.error);
