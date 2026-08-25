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
  'este', 'esta', 'estos', 'estas', 'mío', 'mía', 'míos', 'mías'
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
  if (!startDate || !endDate) return 'Duración estimada estándar de 2 semestres académicos (1 año)';
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

function formatChatbookProject(row, isStudent = false) {
  const participants = row.participants || [];
  return {
    id: row.project_id,
    title: row.title,
    code: row.code,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    line: row.line_name,
    subline: row.subline_name,
    modality: row.modality_name,
    status: row.status_name,
    authors: participants.filter((person) => ['autor', 'coautor'].includes(String(person.role).toLowerCase())),
    teachers: participants.filter((person) => ['asesor', 'jurado', 'docente'].includes(String(person.role).toLowerCase())),
    participants,
  };
}

async function processChatbookQuery(userId, message) {
  const accessRes = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name AS program_name, COALESCE(r.name, 'usuario') AS role_name
     FROM public.users u
     LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
     LEFT JOIN public.roles r ON r.role_id = ur.role_id
     LEFT JOIN public.programs pr ON pr.program_id = u.program_id
     WHERE u.user_id::text = $1
     LIMIT 1`,
    [String(userId)]
  );
  if (accessRes.rows.length === 0) return { error: 'No tienes permisos para consultar esta información.' };

  const user = accessRes.rows[0];
  const role = user.role_name.toLowerCase().includes('admin') ? 'admin' : user.role_name.toLowerCase().includes('docent') ? 'docente' : 'estudiante';
  const programId = user.program_id;
  const programName = user.program_name || 'Universidad CESMAG';
  const norm = normalizeChatbookText(message);
  const text = String(message || '').toLowerCase();

  // Helper SQL filter for program isolation on projects
  const programFilterProjects = programId
    ? `AND (EXISTS (SELECT 1 FROM public.user_projects up_pr JOIN public.users u_pr ON u_pr.user_id = up_pr.user_id WHERE up_pr.project_id = p.project_id AND u_pr.program_id = ${programId} AND (up_pr.project_role = 'autor' OR up_pr.project_role = 'coautor' OR up_pr.project_role IS NULL)))`
    : '';

  // Helper SQL filter for teachers in program
  const programFilterTeachers = programId
    ? `AND (u.program_id = ${programId} OR EXISTS (SELECT 1 FROM public.user_projects up_t JOIN public.projects p_t ON p_t.project_id = up_t.project_id JOIN public.user_projects up_a ON up_a.project_id = p_t.project_id JOIN public.users u_a ON u_a.user_id = up_a.user_id WHERE up_t.user_id = u.user_id AND u_a.program_id = ${programId} AND (up_a.project_role = 'autor' OR up_a.project_role = 'coautor' OR up_a.project_role IS NULL)))`
    : '';

  // ──────────────────────────────────────────────────────────────────────────
  // 1. ESTUDIANTE INTENTS
  // ──────────────────────────────────────────────────────────────────────────
  if (role === 'estudiante') {
    // Student's own projects
    const myProjectsRes = await pool.query(`
      SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
             s.name as status_name, m.name as modality_name,
             rl.name as line_name, rsl.name as subline_name,
             up.project_role,
             COALESCE((SELECT json_agg(json_build_object('name', u2.full_name, 'email', u2.email, 'role', up2.project_role))
                       FROM public.user_projects up2 JOIN public.users u2 ON u2.user_id = up2.user_id
                       WHERE up2.project_id = p.project_id), '[]'::json) as participants
      FROM public.user_projects up
      JOIN public.projects p ON p.project_id = up.project_id
      LEFT JOIN public.statuses s ON s.status_id = p.status_id
      LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
      LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
      LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
      WHERE up.user_id = $1
      ORDER BY p.created_at DESC
    `, [user.user_id]);
    const myProjects = myProjectsRes.rows.map(row => formatChatbookProject(row, true));

    // FECHAS
    if (/cuando inicia mi proyecto|fecha de inicio de mi proyecto/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente en el sistema.', projects: [] };
      const lines = ['FECHA DE INICIO DE TUS PROYECTOS:', ''];
      myProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Fecha de inicio: ${formatDateCO(p.createdAt)}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    if (/cuando termina mi proyecto|fecha de finalizacion de mi proyecto|fecha de terminacion/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente en el sistema.', projects: [] };
      const lines = ['FECHA DE FINALIZACIÓN DE TUS PROYECTOS:', ''];
      myProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Fecha de finalización: ${formatDateCO(p.finishedAt)}`);
        lines.push(`  Tiempo restante: ${getRemainingTime(p.finishedAt)}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    if (/cuanto tiempo dura mi proyecto|duracion de mi proyecto/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const lines = ['DURACIÓN DE TUS PROYECTOS DE GRADO:', ''];
      myProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Duración estimada/registrada: ${getDuration(p.createdAt, p.finishedAt)}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    if (/cuanto falta para que termine mi proyecto|tiempo restante/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const lines = ['TIEMPO RESTANTE PARA CULMINAR TUS PROYECTOS:', ''];
      myProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Estado actual: ${p.status || 'En desarrollo'}`);
        lines.push(`  Tiempo restante: ${getRemainingTime(p.finishedAt)}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    if (/cuales son las fechas de mis proyectos|fechas de mis proyectos/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const lines = ['CRONOGRAMA Y FECHAS DE TUS PROYECTOS:', ''];
      myProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  • Fecha de inicio: ${formatDateCO(p.createdAt)}`);
        lines.push(`  • Fecha de finalización: ${formatDateCO(p.finishedAt)}`);
        lines.push(`  • Estado: ${p.status || 'En curso'}`);
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: myProjects };
    }

    if (/cual de mis proyectos termina primero|proximo a terminar/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const withDates = myProjects.filter(p => p.finishedAt);
      const sorted = withDates.length > 0
        ? [...withDates].sort((a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime())
        : myProjects;
      const first = sorted[0];
      const resp = [
        'PROYECTO MÁS PRÓXIMO A FINALIZAR:',
        '',
        `Proyecto: ${first.code || 'Sin código'} — ${first.title}`,
        `Fecha de finalización: ${formatDateCO(first.finishedAt)}`,
        `Tiempo restante: ${getRemainingTime(first.finishedAt)}`,
        `Estado actual: ${first.status || 'En curso'}`
      ].join('\n');
      return { message: resp, projects: [first] };
    }

    // ESTADOS
    if (/que significa el estado de mi proyecto|significado del estado/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const lines = ['SIGNIFICADO DEL ESTADO DE TUS PROYECTOS:', ''];
      myProjects.forEach(p => {
        lines.push(`Proyecto: ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`Estado actual: ${p.status || 'Sin estado'}`);
        lines.push(`Explicación: ${getStatusMeaning(p.status)}`);
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: myProjects };
    }

    if (/cual es el estado de mi proyecto|cual es el estado de mis proyectos|estado de mi proyecto|estado de mis proyectos/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos asociados a tu cuenta actualmente.', projects: [] };
      const lines = ['ESTADO ACTUAL DE TUS PROYECTOS:', ''];
      myProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Estado: ${p.status || 'Sin estado'}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    if (/proyectos mios estan en ejecucion|proyectos en ejecucion|en curso/.test(norm) && /mio|mis|tengo/.test(norm)) {
      const active = myProjects.filter(p => normalizeChatbookText(p.status).includes('curso') || normalizeChatbookText(p.status).includes('ejecucion'));
      if (active.length === 0) return { message: 'No tienes proyectos en ejecución actualmente.', projects: [] };
      const lines = [`TIENES ${active.length} PROYECTO(S) EN EJECUCIÓN:`, ''];
      active.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title} (${p.line || 'Sin línea'})`));
      return { message: lines.join('\n'), projects: active };
    }

    if (/tengo algun proyecto terminado|proyecto terminado|proyectos terminados/.test(norm) && /mio|mis|tengo/.test(norm)) {
      const done = myProjects.filter(p => normalizeChatbookText(p.status).includes('finalizad') || normalizeChatbookText(p.status).includes('terminad'));
      if (done.length === 0) return { message: 'No tienes proyectos finalizados aún. Tus proyectos continúan en desarrollo.', projects: [] };
      const lines = [`TIENES ${done.length} PROYECTO(S) TERMINADO(S):`, ''];
      done.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title} (Culminó: ${formatDateCO(p.finishedAt)})`));
      return { message: lines.join('\n'), projects: done };
    }

    // PROYECTOS
    if (/cuales son mis proyectos|mis proyectos|muestrame mis proyectos/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos asociados actualmente.', projects: [] };
      const lines = [`TIENES ${myProjects.length} PROYECTO(S) REGISTRADO(S):`, ''];
      myProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Línea: ${p.line || 'Sin línea'} | Estado: ${p.status || 'En curso'}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    // DOCENTES
    if (/quien es mi docente asesor|quien es mi asesor|que docente esta asociado a mi proyecto|docente asesor/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const lines = ['DOCENTES ASESORES ASOCIADOS A TUS PROYECTOS:', ''];
      myProjects.forEach(p => {
        const advisors = p.teachers.filter(t => t.name);
        lines.push(`Proyecto: ${p.code || 'Sin código'} — ${p.title}`);
        if (advisors.length > 0) {
          lines.push(`Asesor(es): ${advisors.map(a => `${a.name} (${a.email || 'Sin correo'})`).join(', ')}`);
        } else {
          lines.push('Asesor(es): Aún no tiene asesor asignado.');
        }
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: myProjects };
    }

    if (/docentes pertenecen a mi linea|docentes de mi linea/.test(norm)) {
      const myLines = [...new Set(myProjects.map(p => p.line).filter(Boolean))];
      if (myLines.length === 0) return { message: 'No tienes una línea de investigación registrada en tus proyectos para consultar sus docentes.', projects: [] };
      const teachersInLineRes = await pool.query(`
        SELECT DISTINCT u.full_name, u.email, rl.name as line_name
        FROM public.users u
        JOIN public.user_projects up ON up.user_id = u.user_id
        JOIN public.projects p ON p.project_id = up.project_id
        JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
        JOIN public.user_roles ur ON ur.user_id = u.user_id
        JOIN public.roles r ON r.role_id = ur.role_id
        WHERE (LOWER(r.name) LIKE '%docent%')
          AND rl.name = ANY($1)
          ${programFilterProjects}
        ORDER BY u.full_name
      `, [myLines]);
      if (teachersInLineRes.rows.length === 0) {
        return { message: `No se encontraron docentes registrados en tu línea (${myLines.join(', ')}) para tu programa.`, projects: [] };
      }
      const lines = [`DOCENTES DE TU LÍNEA DE INVESTIGACIÓN (${myLines.join(', ')}):`, ''];
      teachersInLineRes.rows.forEach(t => lines.push(`- ${t.full_name} (${t.email}) — ${t.line_name}`));
      return { message: lines.join('\n'), projects: [] };
    }

    // LÍNEAS
    if (/cual es mi linea de investigacion|cual es mi linea/.test(norm)) {
      const myLines = [...new Set(myProjects.map(p => p.line).filter(Boolean))];
      if (myLines.length === 0) return { message: 'No tienes una línea de investigación registrada en tus proyectos actualmente.', projects: [] };
      return { message: `Tu línea de investigación registrada en ${programName} es: ${myLines.join(', ')}.`, projects: myProjects };
    }

    if (/cual es la sublinea de mi proyecto|sublinea de mi proyecto/.test(norm)) {
      const mySublines = [...new Set(myProjects.map(p => p.subline).filter(Boolean))];
      if (mySublines.length === 0) return { message: 'No tienes una sublínea registrada en tus proyectos actualmente.', projects: [] };
      return { message: `La sublínea de tu proyecto es: ${mySublines.join(', ')}.`, projects: myProjects };
    }

    if (/proyectos existen en mi linea/.test(norm)) {
      const myLines = [...new Set(myProjects.map(p => p.line).filter(Boolean))];
      if (myLines.length === 0) return { message: 'No tienes una línea de investigación asignada para consultar proyectos similares.', projects: [] };
      const lineProjectsRes = await pool.query(`
        SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
               s.name as status_name, m.name as modality_name,
               rl.name as line_name, rsl.name as subline_name,
               COALESCE((SELECT json_agg(json_build_object('name', u2.full_name, 'email', u2.email, 'role', up2.project_role))
                         FROM public.user_projects up2 JOIN public.users u2 ON u2.user_id = up2.user_id
                         WHERE up2.project_id = p.project_id), '[]'::json) as participants
        FROM public.projects p
        JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
        LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
        LEFT JOIN public.statuses s ON s.status_id = p.status_id
        LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
        WHERE rl.name = ANY($1) ${programFilterProjects}
        ORDER BY p.created_at DESC LIMIT 15
      `, [myLines]);
      const projects = lineProjectsRes.rows.map(row => formatChatbookProject(row, true));
      return {
        message: `Encontré ${projects.length} proyecto(s) en tu línea (${myLines.join(', ')}) en ${programName}:`,
        projects
      };
    }

    if (/que otras lineas existen|lineas existen|lineas de investigacion/.test(norm)) {
      const linesRes = await pool.query(`
        SELECT rl.research_line_id, rl.name, rl.description,
               COALESCE((SELECT json_agg(json_build_object('name', rsl.name, 'description', rsl.description))
                         FROM public.research_sublines rsl WHERE rsl.research_line_id = rl.research_line_id), '[]'::json) as sublines
        FROM public.research_lines rl ORDER BY rl.name
      `);
      const lines = [`LÍNEAS DE INVESTIGACIÓN DISPONIBLES EN ${programName.toUpperCase()}:`, ''];
      linesRes.rows.forEach(l => {
        lines.push(`• ${l.name}: ${l.description || 'Línea de investigación institucional'}`);
        if (l.sublines && l.sublines.length > 0) {
          lines.push(`  Sublíneas: ${l.sublines.map(s => s.name).join(', ')}`);
        }
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: [], lines: linesRes.rows };
    }

    if (/proyectos estan disponibles|banco de proyectos|proyectos disponibles/.test(norm)) {
      const dispRes = await pool.query(`
        SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
               s.name as status_name, m.name as modality_name,
               rl.name as line_name, rsl.name as subline_name,
               COALESCE((SELECT json_agg(json_build_object('name', u2.full_name, 'email', u2.email, 'role', up2.project_role))
                         FROM public.user_projects up2 JOIN public.users u2 ON u2.user_id = up2.user_id
                         WHERE up2.project_id = p.project_id), '[]'::json) as participants
        FROM public.projects p
        LEFT JOIN public.statuses s ON s.status_id = p.status_id
        LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
        LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
        LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
        WHERE (s.name ILIKE '%disponib%' OR s.name ILIKE '%banco%' OR s.name ILIKE '%propuest%')
          ${programFilterProjects}
        ORDER BY p.created_at DESC LIMIT 15
      `);
      const projects = dispRes.rows.map(row => formatChatbookProject(row, true));
      return {
        message: projects.length > 0
          ? `Encontré ${projects.length} proyecto(s) disponibles/propuestas en el Banco de Proyectos de ${programName}:`
          : `Actualmente no hay proyectos con estado disponible en el Banco de Proyectos de ${programName}.`,
        projects
      };
    }
  }

  return null;
}

async function testAll() {
  const studentIng = (await pool.query("SELECT user_id, full_name FROM public.users WHERE user_id = '3fd36425-d73c-4887-b5ec-0853f999333a'")).rows[0];
  console.log('Testing Student:', studentIng.full_name);

  const studentQuestions = [
    '¿Cuándo inicia mi proyecto?',
    '¿Cuándo termina mi proyecto?',
    '¿Cuánto tiempo dura mi proyecto?',
    '¿Cuánto falta para que termine mi proyecto?',
    '¿Cuáles son las fechas de mis proyectos?',
    '¿Cuál de mis proyectos termina primero?',
    '¿Cuál es el estado de mi proyecto?',
    '¿Qué significa el estado de mi proyecto?',
    '¿Qué proyectos míos están en ejecución?',
    '¿Tengo algún proyecto terminado?',
    '¿Cuáles son mis proyectos?',
    '¿Qué proyectos están disponibles?',
    '¿Cuál es mi línea de investigación?',
    '¿Cuál es la sublínea de mi proyecto?',
    '¿Qué proyectos existen en mi línea?',
    '¿Qué otras líneas existen?',
    '¿Quién es mi docente asesor?',
    '¿Qué docentes pertenecen a mi línea?'
  ];

  for (const q of studentQuestions) {
    console.log(`\n================ Q: "${q}" ================`);
    const res = await processChatbookQuery(studentIng.user_id, q);
    console.log(res ? res.message : 'NULL RESPONSE');
  }

  await pool.end();
}

testAll().catch(console.error);
