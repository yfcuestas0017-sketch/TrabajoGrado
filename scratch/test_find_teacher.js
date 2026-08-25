import pool from '../server/db.js';

const CHATBOOK_NOT_FOUND = 'No encuentro esta información registrada actualmente en el sistema.';
const CHATBOOK_STOP_WORDS = new Set([
  'docente', 'docentes', 'profesor', 'profesores', 'profesora', 'profesoras',
  'asesor', 'asesores', 'asesora', 'jurado', 'jurados', 'evaluador', 'evaluadores',
  'sistema', 'investigacion', 'investigación', 'linea', 'línea', 'sublinea', 'sublínea',
  'proyectos', 'proyecto', 'trabajos', 'trabajo', 'nuevo', 'nueva', 'usuario', 'usuarios',
  'cuenta', 'para', 'como', 'sobre', 'tiene', 'estan', 'están', 'cuantos', 'cuántos',
  'cuales', 'cuáles', 'quien', 'quién', 'quienes', 'quiénes', 'informacion', 'información',
  'que', 'qué', 'cual', 'cuál', 'los', 'las', 'del', 'con', 'por', 'son', 'mis', 'sus',
  'este', 'esta', 'estos', 'estas', 'mío', 'mía', 'míos', 'mías', 'todos', 'todas',
  'existen', 'hay', 'cada', 'uno', 'una'
]);

function normalizeChatbookText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

async function findTeacherInChatbook(message, programId = null) {
  const normMessage = normalizeChatbookText(message);

  let querySql = `
    SELECT u.user_id, u.full_name, u.email, pr.name AS program_name, u.program_id
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    WHERE (LOWER(r.name) LIKE '%docent%' OR LOWER(r.name) LIKE '%profesor%')
  `;
  const params = [];
  if (programId) {
    params.push(programId);
    querySql += ` AND (u.program_id = $1 OR EXISTS (SELECT 1 FROM public.user_projects up_t JOIN public.projects p_t ON p_t.project_id = up_t.project_id JOIN public.user_projects up_a ON up_a.project_id = p_t.project_id JOIN public.users u_a ON u_a.user_id = up_a.user_id WHERE up_t.user_id = u.user_id AND u_a.program_id = $1 AND (up_a.project_role = 'autor' OR up_a.project_role = 'coautor' OR up_a.project_role IS NULL)))`;
  }
  querySql += ` ORDER BY LENGTH(u.full_name) DESC`;

  const teachersRes = await pool.query(querySql, params);

  const matched = [];
  for (const t of teachersRes.rows) {
    const normFullName = normalizeChatbookText(t.full_name);
    const normEmail = normalizeChatbookText(t.email);
    const emailUser = normEmail.split('@')[0];

    // 1. Exact full name in text
    if (normFullName.length >= 3 && normMessage.includes(normFullName)) {
      matched.push({ teacher: t, score: 1000 + normFullName.length, reason: `exact name: ${normFullName}` });
      continue;
    }

    // 2. Email user if distinct and not stopword
    if (emailUser.length >= 3 && !CHATBOOK_STOP_WORDS.has(emailUser) && normMessage.includes(emailUser)) {
      matched.push({ teacher: t, score: 500 + emailUser.length, reason: `email user: ${emailUser}` });
      continue;
    }

    // 3. Name parts
    const nameParts = normFullName.split(/\s+/).filter((p) => p.length >= 3 && !CHATBOOK_STOP_WORDS.has(p));
    if (nameParts.length > 0) {
      let matchedParts = 0;
      let matchedChars = 0;
      for (const part of nameParts) {
        const regex = new RegExp(`\\b${part}\\b`, 'i');
        if (regex.test(normMessage)) {
          matchedParts++;
          matchedChars += part.length;
        }
      }
      if (matchedParts > 0) {
        matched.push({ teacher: t, score: (matchedParts * 100) + matchedChars, reason: `name parts: ${nameParts.join(',')}` });
      }
    }
  }

  matched.sort((a, b) => b.score - a.score);
  return matched.length > 0 ? matched[0] : null;
}

async function run() {
  const testMsgs = [
    'Muéstrame proyectos por fecha de finalización.',
    '¿Cuál es la fecha de finalización?',
    '¿Qué docentes existen?',
    '¿Qué proyectos existen en esta línea?',
    'Busca proyectos por modalidad.'
  ];

  for (const m of testMsgs) {
    const res = await findTeacherInChatbook(m);
    console.log(`Msg: "${m}" -> Match:`, res ? `${res.teacher.full_name} (${res.reason})` : 'None');
  }

  await pool.end();
}

run();
