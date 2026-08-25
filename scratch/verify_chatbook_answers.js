import pool from '../server/db.js';

// We will replicate the entire chatbook logic from server/index.js, test every single question from Chatbook.jsx,
// and identify every case that does not produce the expected response.

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

function normalizeChatbookRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('docent') || normalized.includes('asesor') || normalized.includes('profesor')) return 'docente';
  if (normalized.includes('estudiant')) return 'estudiante';
  return 'estudiante';
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
    createdAt: isStudent ? null : row.created_at,
    finishedAt: isStudent ? null : row.finished_at,
    line: row.line_name,
    subline: row.subline_name,
    modality: row.modality_name,
    status: isStudent ? null : row.status_name,
    authors: participants.filter((person) => ['autor', 'coautor'].includes(String(person.role).toLowerCase())),
    teachers: isStudent ? [] : participants.filter((person) => ['asesor', 'jurado', 'docente'].includes(String(person.role).toLowerCase())),
    participants,
  };
}

function formatProjectMessage(project, role = 'usuario') {
  const isStudent = role === 'estudiante';
  const peopleInfo = (people) => people.length
    ? people.map((person) => [person.name, person.email, person.program].filter(Boolean).join(' · ') + (person.role ? ` (${person.role})` : '')).join(', ')
    : CHATBOOK_NOT_FOUND;

  const lines = [
    'INFORMACIÓN DEL PROYECTO',
    `Nombre: ${project.title || CHATBOOK_NOT_FOUND}`,
    `Código: ${project.code || CHATBOOK_NOT_FOUND}`,
  ];

  if (!isStudent) {
    lines.push(`Estado: ${project.status || CHATBOOK_NOT_FOUND}`);
    lines.push(`Fecha de inicio: ${project.createdAt ? new Date(project.createdAt).toLocaleDateString('es-CO') : CHATBOOK_NOT_FOUND}`);
    lines.push(`Fecha de finalización: ${project.finishedAt ? new Date(project.finishedAt).toLocaleDateString('es-CO') : CHATBOOK_NOT_FOUND}`);
  }

  lines.push(`Línea de investigación: ${project.line || CHATBOOK_NOT_FOUND}`);
  lines.push(`Sublínea de investigación: ${project.subline || CHATBOOK_NOT_FOUND}`);
  lines.push(`Modalidad: ${project.modality || CHATBOOK_NOT_FOUND}`);
  lines.push(`Autores: ${peopleInfo(project.authors || [])}`);

  if (!isStudent) {
    lines.push(`Docentes asociados: ${peopleInfo(project.teachers || [])}`);
  }

  return lines.join('\n');
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

    // Word boundary match for full name
    const fullNameRegex = new RegExp(`\\b${normFullName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (normFullName.length >= 3 && fullNameRegex.test(normMessage)) {
      matched.push({ teacher: t, score: 1000 + normFullName.length });
      continue;
    }

    // Email user if distinct and not stopword
    if (emailUser.length >= 3 && !CHATBOOK_STOP_WORDS.has(emailUser)) {
      const emailRegex = new RegExp(`\\b${emailUser.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (emailRegex.test(normMessage)) {
        matched.push({ teacher: t, score: 500 + emailUser.length });
        continue;
      }
    }

    // Name parts
    const nameParts = normFullName.split(/\s+/).filter((p) => p.length >= 3 && !CHATBOOK_STOP_WORDS.has(p));
    if (nameParts.length > 0) {
      let matchedParts = 0;
      let matchedChars = 0;
      for (const part of nameParts) {
        const regex = new RegExp(`\\b${part.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (regex.test(normMessage)) {
          matchedParts++;
          matchedChars += part.length;
        }
      }
      if (matchedParts > 0) {
        matched.push({ teacher: t, score: (matchedParts * 100) + matchedChars });
      }
    }
  }

  matched.sort((a, b) => b.score - a.score);
  return matched.length > 0 ? matched[0].teacher : null;
}

async function getTeacherFullProfile(teacherId, programId = null) {
  const teacherRes = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, pr.name AS program_name, u.program_id
     FROM public.users u
     LEFT JOIN public.programs pr ON pr.program_id = u.program_id
     WHERE u.user_id = $1`,
    [teacherId]
  );
  if (teacherRes.rows.length === 0) return null;
  const teacher = teacherRes.rows[0];

  let projectsSql = `
    SELECT 
       p.project_id,
       p.code,
       p.title,
       s.name AS status_name,
       rl.name AS line_name,
       rsl.name AS subline_name,
       COALESCE(up.project_role, 'asesor') AS project_role,
       p.created_at,
       p.finished_at
     FROM public.user_projects up
     JOIN public.projects p ON p.project_id = up.project_id
     LEFT JOIN public.statuses s ON s.status_id = p.status_id
     LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
     LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
     WHERE up.user_id = $1
  `;
  const params = [teacherId];
  if (programId) {
    params.push(programId);
    projectsSql += ` AND (EXISTS (SELECT 1 FROM public.user_projects up_pr JOIN public.users u_pr ON u_pr.user_id = up_pr.user_id WHERE up_pr.project_id = p.project_id AND u_pr.program_id = $2 AND (up_pr.project_role = 'autor' OR up_pr.project_role = 'coautor' OR up_pr.project_role IS NULL)))`;
  }
  projectsSql += ` ORDER BY p.code`;

  const projectsRes = await pool.query(projectsSql, params);

  const projects = projectsRes.rows.map((row) => ({
    id: row.project_id,
    title: row.title,
    code: row.code,
    line: row.line_name,
    subline: row.subline_name,
    status: row.status_name,
    project_role: row.project_role,
    authors: [],
    teachers: [{ name: teacher.full_name, email: teacher.email }],
  }));

  const lines = [...new Set(projectsRes.rows.map((p) => p.line_name).filter(Boolean))];
  const sublines = [...new Set(projectsRes.rows.map((p) => p.subline_name).filter(Boolean))];

  const asesorProjects = projects.filter((p) => String(p.project_role).toLowerCase().includes('asesor'));
  const juradoProjects = projects.filter((p) => String(p.project_role).toLowerCase().includes('jurado'));
  const otherProjects = projects.filter((p) =>
    !String(p.project_role).toLowerCase().includes('asesor') &&
    !String(p.project_role).toLowerCase().includes('jurado')
  );

  const otherRolesMap = {};
  otherProjects.forEach((p) => {
    const roleKey = p.project_role || 'otro';
    if (!otherRolesMap[roleKey]) otherRolesMap[roleKey] = [];
    otherRolesMap[roleKey].push(p);
  });

  return {
    teacher,
    projects,
    lines,
    sublines,
    totalProjects: projects.length,
    asesorProjects,
    juradoProjects,
    otherRolesMap,
  };
}

async function getAllTeachersWithStats(programId = null) {
  let teachersSql = `
    SELECT u.user_id, u.full_name, u.email, pr.name AS program_name
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    WHERE (LOWER(r.name) LIKE '%docent%' OR LOWER(r.name) LIKE '%profesor%')
  `;
  const params = [];
  if (programId) {
    params.push(programId);
    teachersSql += ` AND (u.program_id = $1 OR EXISTS (SELECT 1 FROM public.user_projects up_t JOIN public.projects p_t ON p_t.project_id = up_t.project_id JOIN public.user_projects up_a ON up_a.project_id = p_t.project_id JOIN public.users u_a ON u_a.user_id = up_a.user_id WHERE up_t.user_id = u.user_id AND u_a.program_id = $1 AND (up_a.project_role = 'autor' OR up_a.project_role = 'coautor' OR up_a.project_role IS NULL)))`;
  }
  teachersSql += ` ORDER BY u.full_name`;

  const teachersRes = await pool.query(teachersSql, params);

  const teacherList = [];
  for (const t of teachersRes.rows) {
    const profile = await getTeacherFullProfile(t.user_id, programId);
    if (profile) {
      teacherList.push(profile);
    }
  }
  return teacherList;
}

function formatTeacherDetailMessage(profile) {
  const { teacher, lines, sublines, totalProjects, asesorProjects, juradoProjects, otherRolesMap } = profile;

  const linesText = lines.length > 0 ? lines.join(', ') : 'Sin línea registrada actualmente';
  const sublinesText = sublines.length > 0 ? sublines.join(', ') : 'Sin sublínea registrada';

  const output = [
    'INFORMACIÓN DEL DOCENTE',
    '',
    `Nombre: ${teacher.full_name || CHATBOOK_NOT_FOUND}`,
    `Línea de investigación: ${linesText}`,
    `Sublínea: ${sublinesText}`,
    '',
    'Participación en proyectos:',
    `- Total de proyectos: ${totalProjects}`,
    `- Como asesor: ${asesorProjects.length}`,
    `- Como jurado: ${juradoProjects.length}`,
  ];

  for (const [roleName, pList] of Object.entries(otherRolesMap)) {
    output.push(`- Como ${roleName}: ${pList.length}`);
  }

  if (asesorProjects.length > 0) {
    output.push('');
    output.push('Proyectos como asesor:');
    asesorProjects.forEach((p) => {
      output.push(`- ${p.code || 'Sin código'} — ${p.title || 'Sin título'}`);
    });
  }

  if (juradoProjects.length > 0) {
    output.push('');
    output.push('Proyectos como jurado:');
    juradoProjects.forEach((p) => {
      output.push(`- ${p.code || 'Sin código'} — ${p.title || 'Sin título'}`);
    });
  }

  for (const [roleName, pList] of Object.entries(otherRolesMap)) {
    output.push('');
    output.push(`Proyectos como ${roleName}:`);
    pList.forEach((p) => {
      output.push(`- ${p.code || 'Sin código'} — ${p.title || 'Sin título'}`);
    });
  }

  return output.join('\n');
}

// Now handle query function
async function handleChatbookQuery(userId, message) {
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
  if (accessRes.rows.length === 0) {
    return { error: 'No tienes permisos.' };
  }

  const currentUser = accessRes.rows[0];
  const role = normalizeChatbookRole(currentUser.role_name);
  const isStudent = role === 'estudiante';
  const isTeacher = role === 'docente';
  const isAdmin = role === 'admin';
  const programId = currentUser.program_id;
  const programName = currentUser.program_name || 'Universidad CESMAG';

  const norm = normalizeChatbookText(message);
  const rawText = String(message || '');
  const projectCode = rawText.match(/\b[A-Z]{1,8}-\d+\b/i)?.[0] || '';

  const programProjectScope = programId
    ? `AND (EXISTS (SELECT 1 FROM public.user_projects up_pr JOIN public.users u_pr ON u_pr.user_id = up_pr.user_id WHERE up_pr.project_id = p.project_id AND u_pr.program_id = ${programId} AND (up_pr.project_role = 'autor' OR up_pr.project_role = 'coautor' OR up_pr.project_role IS NULL)))`
    : '';

  // A. Code
  if (projectCode) {
    const codeRes = await pool.query(`
      SELECT p.project_id, p.title, p.code, p.created_at, p.finished_at,
             s.name AS status_name, m.name AS modality_name,
             rl.name AS line_name, rsl.name AS subline_name,
             COALESCE((SELECT json_agg(json_build_object('name', u.full_name, 'email', u.email, 'program', pr.name, 'role', COALESCE(up.project_role, 'autor')) ORDER BY u.full_name)
                       FROM public.user_projects up JOIN public.users u ON u.user_id = up.user_id
                       LEFT JOIN public.programs pr ON pr.program_id = u.program_id
                       WHERE up.project_id = p.project_id), '[]'::json) AS participants
      FROM public.projects p
      LEFT JOIN public.statuses s ON s.status_id = p.status_id
      LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
      LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
      LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
      WHERE p.code ILIKE $1
      LIMIT 1
    `, [projectCode]);

    if (codeRes.rows.length > 0) {
      const formatted = formatChatbookProject(codeRes.rows[0], isStudent);
      return { message: formatProjectMessage(formatted, role), projects: [formatted] };
    }
  }

  // B. Matched teacher (only if specifically asking about a teacher by name or professor query)
  const isGenericTeacherQuestion = /que docentes existen|que docentes estan|que docentes son|que docentes pertenecen|que docentes tienen|docentes pertenecen a cada linea|docentes por linea|docentes de mi linea|docentes pertenecen a mi linea|docentes pertenecen a esta linea/.test(norm);
  const isGenericDateOrLineQuestion = /fecha de inicio|fecha de finalizacion|proximos a terminar|lineas de investigacion|modalidad/.test(norm) && !/profesor|docente|asesor/.test(norm);
  
  let matchedTeacher = null;
  if (!isGenericTeacherQuestion && !isGenericDateOrLineQuestion) {
    matchedTeacher = (!isStudent || /quien es|profesor|docente|asesor/.test(norm))
      ? await findTeacherInChatbook(message, isAdmin ? programId : null)
      : null;
  }

  if (matchedTeacher) {
    if (isStudent && !/quien es mi|mi docente|mi asesor|mi proyecto/.test(norm)) {
      return { message: 'La consulta general sobre otros docentes no está disponible para el perfil de estudiante.', projects: [] };
    }

    const profile = await getTeacherFullProfile(matchedTeacher.user_id, programId);
    if (profile) {
      const asksOnlyLine = /linea de investigacion|lineas de investigacion|a que linea|cual es su linea|cual es la linea/.test(norm) && !/proyectos|trabajos|cuantos/.test(norm);
      const asksCountsOnly = /cuantos trabajos|cuantos proyectos|cantidad de trabajos|cantidad de proyectos|total de proyectos|total de trabajos/.test(norm);
      const asksAsesorCount = asksCountsOnly && /asesor/.test(norm);
      const asksJuradoCount = asksCountsOnly && /jurado/.test(norm);
      const asksAsesorProjects = /en que proyectos es asesor|proyectos como asesor|trabajos como asesor/.test(norm);
      const asksJuradoProjects = /en que proyectos es jurado|proyectos como jurado|trabajos como jurado/.test(norm);

      if (asksOnlyLine) {
        const lineStr = profile.lines.length > 0 ? profile.lines.join(', ') : 'Sin línea registrada actualmente';
        const sublineStr = profile.sublines.length > 0 ? profile.sublines.join(', ') : 'Sin sublínea registrada';
        const resp = [
          'LÍNEA DE INVESTIGACIÓN DEL DOCENTE',
          '',
          `Docente: ${profile.teacher.full_name}`,
          `Línea de investigación: ${lineStr}`,
          `Sublínea: ${sublineStr}`,
          '',
          `Participación: ${profile.totalProjects} proyecto(s) (${profile.asesorProjects.length} como asesor, ${profile.juradoProjects.length} como jurado).`,
        ].join('\n');
        return { message: resp, projects: profile.projects };
      }

      if (asksAsesorCount) {
        const resp = [
          'PARTICIPACIÓN COMO ASESOR',
          '',
          `Docente: ${profile.teacher.full_name}`,
          `Cantidad de proyectos como asesor: ${profile.asesorProjects.length}`,
          ...(profile.asesorProjects.length > 0 ? [
            '',
            'Proyectos:',
            ...profile.asesorProjects.map((p) => `- ${p.code || 'Sin código'} — ${p.title}`),
          ] : []),
        ].join('\n');
        return { message: resp, projects: profile.asesorProjects };
      }

      if (asksJuradoCount) {
        const resp = [
          'PARTICIPACIÓN COMO JURADO',
          '',
          `Docente: ${profile.teacher.full_name}`,
          `Cantidad de proyectos como jurado: ${profile.juradoProjects.length}`,
          ...(profile.juradoProjects.length > 0 ? [
            '',
            'Proyectos:',
            ...profile.juradoProjects.map((p) => `- ${p.code || 'Sin código'} — ${p.title}`),
          ] : []),
        ].join('\n');
        return { message: resp, projects: profile.juradoProjects };
      }

      if (asksCountsOnly) {
        const resp = [
          'TOTAL DE PROYECTOS DEL DOCENTE',
          '',
          `Docente: ${profile.teacher.full_name}`,
          `Total de proyectos registrados: ${profile.totalProjects}`,
          `- Como asesor: ${profile.asesorProjects.length}`,
          `- Como jurado: ${profile.juradoProjects.length}`,
          ...Object.entries(profile.otherRolesMap).map(([r, l]) => `- Como ${r}: ${l.length}`),
        ].join('\n');
        return { message: resp, projects: profile.projects };
      }

      if (asksAsesorProjects) {
        const resp = [
          `PROYECTOS COMO ASESOR — ${profile.teacher.full_name}`,
          '',
          `Total como asesor: ${profile.asesorProjects.length}`,
          ...(profile.asesorProjects.length > 0 ? [
            '',
            ...profile.asesorProjects.map((p) => `- ${p.code || 'Sin código'} — ${p.title} (${p.line || 'Sin línea'})`),
          ] : ['No registra proyectos como asesor.']),
        ].join('\n');
        return { message: resp, projects: profile.asesorProjects };
      }

      if (asksJuradoProjects) {
        const resp = [
          `PROYECTOS COMO JURADO — ${profile.teacher.full_name}`,
          '',
          `Total como jurado: ${profile.juradoProjects.length}`,
          ...(profile.juradoProjects.length > 0 ? [
            '',
            ...profile.juradoProjects.map((p) => `- ${p.code || 'Sin código'} — ${p.title} (${p.line || 'Sin línea'})`),
          ] : ['No registra proyectos como jurado.']),
        ].join('\n');
        return { message: resp, projects: profile.juradoProjects };
      }

      return {
        message: formatTeacherDetailMessage(profile),
        projects: profile.projects,
      };
    }
  }

  // 1. ESTUDIANTE
  if (isStudent) {
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
    `, [currentUser.user_id]);
    const myProjects = myProjectsRes.rows.map(row => formatChatbookProject(row, true));

    // FECHAS
    if (/cuando inicia mi proyecto|fecha de inicio de mi proyecto|fecha de inicio/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente en el sistema.', projects: [] };
      const lines = ['FECHA DE INICIO DE TUS PROYECTOS:', ''];
      myProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Fecha de inicio: ${formatDateCO(p.createdAt || myProjectsRes.rows.find(r => r.project_id === p.id)?.created_at)}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    if (/cuando termina mi proyecto|fecha de finalizacion de mi proyecto|fecha de terminacion|fecha de finalizacion/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente en el sistema.', projects: [] };
      const lines = ['FECHA DE FINALIZACIÓN DE TUS PROYECTOS:', ''];
      myProjectsRes.rows.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Fecha de finalización: ${formatDateCO(p.finished_at)}`);
        lines.push(`  Tiempo restante: ${getRemainingTime(p.finished_at)}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    if (/cuanto tiempo dura mi proyecto|duracion de mi proyecto|duracion/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const lines = ['DURACIÓN DE TUS PROYECTOS DE GRADO:', ''];
      myProjectsRes.rows.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Duración estimada/registrada: ${getDuration(p.created_at, p.finished_at)}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    if (/cuanto falta para que termine mi proyecto|tiempo restante/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const lines = ['TIEMPO RESTANTE PARA CULMINAR TUS PROYECTOS:', ''];
      myProjectsRes.rows.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Estado actual: ${p.status_name || 'En desarrollo'}`);
        lines.push(`  Tiempo restante: ${getRemainingTime(p.finished_at)}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    if (/cuales son las fechas de mis proyectos|fechas de mis proyectos/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const lines = ['CRONOGRAMA Y FECHAS DE TUS PROYECTOS:', ''];
      myProjectsRes.rows.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  • Fecha de inicio: ${formatDateCO(p.created_at)}`);
        lines.push(`  • Fecha de finalización: ${formatDateCO(p.finished_at)}`);
        lines.push(`  • Estado: ${p.status_name || 'En curso'}`);
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: myProjects };
    }

    if (/cual de mis proyectos termina primero|proximo a terminar/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const withDates = myProjectsRes.rows.filter(p => p.finished_at);
      const sorted = withDates.length > 0
        ? [...withDates].sort((a, b) => new Date(a.finished_at).getTime() - new Date(b.finished_at).getTime())
        : myProjectsRes.rows;
      const first = sorted[0];
      const resp = [
        'PROYECTO MÁS PRÓXIMO A FINALIZAR:',
        '',
        `Proyecto: ${first.code || 'Sin código'} — ${first.title}`,
        `Fecha de finalización: ${formatDateCO(first.finished_at)}`,
        `Tiempo restante: ${getRemainingTime(first.finished_at)}`,
        `Estado actual: ${first.status_name || 'En curso'}`
      ].join('\n');
      return { message: resp, projects: [formatChatbookProject(first, true)] };
    }

    // ESTADOS
    if (/que significa el estado de mi proyecto|significado del estado/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const lines = ['SIGNIFICADO DEL ESTADO DE TUS PROYECTOS:', ''];
      myProjectsRes.rows.forEach(p => {
        lines.push(`Proyecto: ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`Estado actual: ${p.status_name || 'Sin estado'}`);
        lines.push(`Explicación: ${getStatusMeaning(p.status_name)}`);
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: myProjects };
    }

    if (/cual es el estado de mi proyecto|cual es el estado de mis proyectos|estado de mi proyecto|estado de mis proyectos/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos asociados a tu cuenta actualmente.', projects: [] };
      const lines = ['ESTADO ACTUAL DE TUS PROYECTOS:', ''];
      myProjectsRes.rows.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Estado: ${p.status_name || 'Sin estado'}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    if (/proyectos mios estan en ejecucion|proyectos en ejecucion|en curso/.test(norm) && /mio|mis|tengo/.test(norm)) {
      const activeRows = myProjectsRes.rows.filter(p => normalizeChatbookText(p.status_name).includes('curso') || normalizeChatbookText(p.status_name).includes('ejecucion'));
      if (activeRows.length === 0) return { message: 'No tienes proyectos en ejecución actualmente.', projects: [] };
      const active = activeRows.map(r => formatChatbookProject(r, true));
      const lines = [`TIENES ${active.length} PROYECTO(S) EN EJECUCIÓN:`, ''];
      active.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title} (${p.line || 'Sin línea'})`));
      return { message: lines.join('\n'), projects: active };
    }

    if (/tengo algun proyecto terminado|proyecto terminado|proyectos terminados/.test(norm) && /mio|mis|tengo/.test(norm)) {
      const doneRows = myProjectsRes.rows.filter(p => normalizeChatbookText(p.status_name).includes('finalizad') || normalizeChatbookText(p.status_name).includes('terminad'));
      if (doneRows.length === 0) return { message: 'No tienes proyectos finalizados aún. Tus proyectos continúan en desarrollo.', projects: [] };
      const done = doneRows.map(r => formatChatbookProject(r, true));
      const lines = [`TIENES ${done.length} PROYECTO(S) TERMINADO(S):`, ''];
      doneRows.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title} (Culminó: ${formatDateCO(p.finished_at)})`));
      return { message: lines.join('\n'), projects: done };
    }

    // PROYECTOS
    if (/cuales son mis proyectos|mis proyectos|muestrame mis proyectos/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos asociados actualmente.', projects: [] };
      const lines = [`TIENES ${myProjects.length} PROYECTO(S) REGISTRADO(S):`, ''];
      myProjectsRes.rows.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Línea: ${p.line_name || 'Sin línea'} | Estado: ${p.status_name || 'En curso'}`);
      });
      return { message: lines.join('\n'), projects: myProjects };
    }

    // DOCENTES
    if (/quien es mi docente asesor|quien es mi asesor|que docente esta asociado a mi proyecto|docente asesor/.test(norm)) {
      if (myProjects.length === 0) return { message: 'No tienes proyectos registrados actualmente.', projects: [] };
      const lines = ['DOCENTES ASESORES ASOCIADOS A TUS PROYECTOS:', ''];
      myProjectsRes.rows.forEach(p => {
        const parts = p.participants || [];
        const advisors = parts.filter(t => ['asesor', 'docente', 'jurado'].includes(String(t.role).toLowerCase()));
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
          ${programProjectScope}
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

    if (/proyectos existen en mi linea|proyectos relacionados con mi linea|proyectos similares/.test(norm)) {
      const myLines = [...new Set(myProjects.map(p => p.line).filter(Boolean))];
      const lineFilter = myLines.length > 0 ? myLines : ['Inteligencia Artificial', 'Ingeniería de Software'];
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
        WHERE rl.name = ANY($1) ${programProjectScope}
        ORDER BY p.created_at DESC LIMIT 15
      `, [lineFilter]);
      const projects = lineProjectsRes.rows.map(row => formatChatbookProject(row, true));
      return {
        message: `Encontré ${projects.length} proyecto(s) en la línea (${lineFilter.join(', ')}) en ${programName}:`,
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
          ${programProjectScope}
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

  // 2. DOCENTE
  if (isTeacher) {
    const advisedProjectsRes = await pool.query(`
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
    `, [currentUser.user_id]);
    const advisedProjects = advisedProjectsRes.rows.map(row => formatChatbookProject(row, false));

    // FECHAS
    if (/cuando terminan los proyectos que asesoro|fechas de los proyectos que asesoro|fechas de los proyectos/.test(norm)) {
      if (advisedProjects.length === 0) return { message: 'No tienes proyectos asignados como asesor actualmente.', projects: [] };
      const lines = ['CRONOGRAMA DE PROYECTOS QUE ASESORAS:', ''];
      advisedProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Inicio: ${formatDateCO(p.createdAt)} | Finalización: ${formatDateCO(p.finishedAt)}`);
        lines.push(`  Estado: ${p.status || 'En curso'} | Restante: ${getRemainingTime(p.finishedAt)}`);
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: advisedProjects };
    }

    if (/proyectos estan proximos a terminar|proximos a terminar/.test(norm) && !/todos/.test(norm)) {
      if (advisedProjects.length === 0) return { message: 'No tienes proyectos asignados actualmente.', projects: [] };
      const sorted = [...advisedProjects].sort((a, b) => new Date(a.finishedAt || '2099-01-01').getTime() - new Date(b.finishedAt || '2099-01-01').getTime());
      const lines = ['PROYECTOS QUE ASESORAS ORDENADOS POR FECHA DE FINALIZACIÓN:', ''];
      sorted.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Fecha de fin: ${formatDateCO(p.finishedAt)} (${getRemainingTime(p.finishedAt)})`);
      });
      return { message: lines.join('\n'), projects: sorted };
    }

    if (/fecha de inicio de este proyecto|fecha de inicio|fecha de finalizacion/.test(norm)) {
      if (advisedProjects.length === 0) return { message: 'No tienes proyectos asignados actualmente.', projects: [] };
      const lines = ['FECHAS DE TUS PROYECTOS ASIGNADOS:', ''];
      advisedProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Inicio: ${formatDateCO(p.createdAt)} | Fin: ${formatDateCO(p.finishedAt)}`);
      });
      return { message: lines.join('\n'), projects: advisedProjects };
    }

    // ESTADOS
    if (/cual es el estado de los proyectos que asesoro|estado de los proyectos que asesoro/.test(norm)) {
      if (advisedProjects.length === 0) return { message: 'No tienes proyectos asignados actualmente.', projects: [] };
      const lines = ['ESTADO DE LOS PROYECTOS QUE ASESORAS:', ''];
      advisedProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Estado: ${p.status || 'En curso'} (${p.line || 'Sin línea'})`);
      });
      return { message: lines.join('\n'), projects: advisedProjects };
    }

    if (/cuantos proyectos tengo en cada estado|proyectos tengo en cada estado/.test(norm)) {
      if (advisedProjects.length === 0) return { message: 'No tienes proyectos asignados actualmente.', projects: [] };
      const counts = {};
      advisedProjects.forEach(p => {
        const st = p.status || 'Sin estado';
        counts[st] = (counts[st] || 0) + 1;
      });
      const lines = [`TOTAL DE PROYECTOS ASESORADOS (${advisedProjects.length}) POR ESTADO:`, ''];
      Object.entries(counts).forEach(([st, cnt]) => lines.push(`- ${st}: ${cnt} proyecto(s)`));
      return { message: lines.join('\n'), projects: advisedProjects };
    }

    if (/proyectos estan en ejecucion|en ejecucion/.test(norm)) {
      const active = advisedProjects.filter(p => normalizeChatbookText(p.status).includes('curso') || normalizeChatbookText(p.status).includes('ejecucion'));
      const lines = [`PROYECTOS EN EJECUCIÓN (${active.length}):`, ''];
      active.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title}`));
      return { message: lines.join('\n'), projects: active };
    }

    if (/proyectos estan terminados|terminados/.test(norm)) {
      const done = advisedProjects.filter(p => normalizeChatbookText(p.status).includes('finalizad') || normalizeChatbookText(p.status).includes('terminad'));
      const lines = [`PROYECTOS TERMINADOS (${done.length}):`, ''];
      done.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title} (Fin: ${formatDateCO(p.finishedAt)})`));
      return { message: lines.join('\n'), projects: done };
    }

    if (/proyectos estan pendientes|pendientes/.test(norm)) {
      const pending = advisedProjects.filter(p => normalizeChatbookText(p.status).includes('propuest') || normalizeChatbookText(p.status).includes('pendient') || normalizeChatbookText(p.status).includes('radicad'));
      const lines = [`PROYECTOS PENDIENTES / EN PROPUESTA (${pending.length}):`, ''];
      pending.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title}`));
      return { message: lines.join('\n'), projects: pending };
    }

    // PROYECTOS Y ASIGNACIONES
    if (/que proyectos tengo asignados|que proyectos asesoro|proyectos que asesoro/.test(norm)) {
      if (advisedProjects.length === 0) return { message: 'No tienes proyectos asignados actualmente en el sistema.', projects: [] };
      const lines = [`PROYECTOS ASIGNADOS A TU CARGO (${advisedProjects.length}):`, ''];
      advisedProjects.forEach(p => {
        const authors = p.authors.map(a => a.name).join(', ') || 'Sin autores';
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Autores: ${authors} | Estado: ${p.status || 'En curso'}`);
        lines.push(`  Línea: ${p.line || 'Sin línea'}`);
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: advisedProjects };
    }

    if (/estudiantes estan asociados a mis proyectos|estudiantes asociados/.test(norm)) {
      if (advisedProjects.length === 0) return { message: 'No tienes proyectos asignados actualmente.', projects: [] };
      const lines = ['ESTUDIANTES ASOCIADOS A TUS PROYECTOS:', ''];
      advisedProjects.forEach(p => {
        lines.push(`Proyecto: ${p.code || 'Sin código'} — ${p.title}`);
        if (p.authors && p.authors.length > 0) {
          p.authors.forEach(a => lines.push(`  • ${a.name} (${a.email || 'Sin correo'})`));
        } else {
          lines.push('  • Sin estudiantes registrados');
        }
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: advisedProjects };
    }

    // LÍNEAS
    if (/a que linea pertenece este proyecto|linea pertenece este proyecto/.test(norm)) {
      if (advisedProjects.length === 0) return { message: 'No tienes proyectos asignados para consultar su línea.', projects: [] };
      const lines = ['LÍNEAS DE TUS PROYECTOS ASIGNADOS:', ''];
      advisedProjects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}: Línea ${p.line || 'Sin línea'} (Sublínea: ${p.subline || 'Sin sublínea'})`);
      });
      return { message: lines.join('\n'), projects: advisedProjects };
    }

    if (/proyectos existen en mi linea|proyectos existen en esta linea|relacionados con esta tematica/.test(norm)) {
      const teacherLines = [...new Set(advisedProjects.map(p => p.line).filter(Boolean))];
      const lineFilter = teacherLines.length > 0 ? teacherLines : ['Inteligencia Artificial', 'Ingeniería de Software'];
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
        WHERE rl.name = ANY($1) ${programProjectScope}
        ORDER BY p.created_at DESC LIMIT 15
      `, [lineFilter]);
      const projects = lineProjectsRes.rows.map(row => formatChatbookProject(row, false));
      return {
        message: `Encontré ${projects.length} proyecto(s) en la línea (${lineFilter.join(', ')}) para ${programName}:`,
        projects
      };
    }

    if (/sublineas pertenecen a esta linea|sublineas/.test(norm)) {
      const sublinesRes = await pool.query(`
        SELECT rl.name as line_name, rsl.name as subline_name
        FROM public.research_sublines rsl
        JOIN public.research_lines rl ON rl.research_line_id = rsl.research_line_id
        ORDER BY rl.name, rsl.name
      `);
      const grouped = {};
      sublinesRes.rows.forEach(r => {
        if (!grouped[r.line_name]) grouped[r.line_name] = [];
        grouped[r.line_name].push(r.subline_name);
      });
      const lines = ['SUBLÍNEAS POR LÍNEA DE INVESTIGACIÓN:', ''];
      Object.entries(grouped).forEach(([lName, sList]) => {
        lines.push(`• ${lName}:`);
        lines.push(`  ${sList.join(', ')}`);
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: [] };
    }

    if (/docentes pertenecen a esta linea|docentes de esta linea/.test(norm)) {
      const teacherLines = [...new Set(advisedProjects.map(p => p.line).filter(Boolean))];
      const lineFilter = teacherLines.length > 0 ? teacherLines : ['Inteligencia Artificial', 'Ingeniería de Software'];
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
          ${programProjectScope}
        ORDER BY u.full_name
      `, [lineFilter]);
      const lines = [`DOCENTES ASOCIADOS A LA LÍNEA (${lineFilter.join(', ')}):`, ''];
      teachersInLineRes.rows.forEach(t => lines.push(`- ${t.full_name} (${t.email}) — ${t.line_name}`));
      return { message: lines.join('\n'), projects: [] };
    }
  }

  // 3. ADMIN
  if (isAdmin) {
    if (/proyectos estan proximos a terminar|proximos a terminar/.test(norm)) {
      const proxRes = await pool.query(`
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
        WHERE p.finished_at IS NOT NULL ${programProjectScope}
        ORDER BY p.finished_at ASC LIMIT 10
      `);
      const projects = proxRes.rows.map(row => formatChatbookProject(row, false));
      const lines = [`PROYECTOS PRÓXIMOS A TERMINAR EN ${programName.toUpperCase()}:`, ''];
      projects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Finalización: ${formatDateCO(p.finishedAt)} (${getRemainingTime(p.finishedAt)}) | Estado: ${p.status}`);
      });
      return { message: lines.join('\n'), projects };
    }

    if (/proyectos comenzaron recientemente|comenzaron recientemente/.test(norm)) {
      const recentRes = await pool.query(`
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
        WHERE 1=1 ${programProjectScope}
        ORDER BY p.created_at DESC LIMIT 10
      `);
      const projects = recentRes.rows.map(row => formatChatbookProject(row, false));
      const lines = [`PROYECTOS INICIADOS RECIENTEMENTE EN ${programName.toUpperCase()}:`, ''];
      projects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Inició: ${formatDateCO(p.createdAt)} | Estado: ${p.status}`);
      });
      return { message: lines.join('\n'), projects };
    }

    if (/proyectos terminan este mes|terminan este mes/.test(norm)) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const monthRes = await pool.query(`
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
        WHERE EXTRACT(MONTH FROM p.finished_at) = $1 AND EXTRACT(YEAR FROM p.finished_at) = $2
          ${programProjectScope}
        ORDER BY p.finished_at ASC
      `, [currentMonth, currentYear]);
      const projects = monthRes.rows.map(row => formatChatbookProject(row, false));
      const lines = [`PROYECTOS QUE TERMINAN ESTE MES (${projects.length}):`, ''];
      if (projects.length > 0) {
        projects.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title} (Fecha: ${formatDateCO(p.finishedAt)})`));
      } else {
        lines.push('No hay proyectos con fecha de finalización programada para el mes actual.');
      }
      return { message: lines.join('\n'), projects };
    }

    if (/fechas de los proyectos|por fecha de finalizacion/.test(norm)) {
      const datesRes = await pool.query(`
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
        WHERE 1=1 ${programProjectScope}
        ORDER BY p.finished_at ASC NULLS LAST LIMIT 15
      `);
      const projects = datesRes.rows.map(row => formatChatbookProject(row, false));
      const lines = [`FECHAS DE PROYECTOS EN ${programName.toUpperCase()}:`, ''];
      projects.forEach(p => {
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Inicio: ${formatDateCO(p.createdAt)} | Fin: ${formatDateCO(p.finishedAt)} | Estado: ${p.status}`);
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects };
    }

    // ESTADOS Y CONTEOS
    if (/cuantos proyectos existen por estado|proyectos por estado|existen por estado|busca proyectos por estado/.test(norm)) {
      const countsRes = await pool.query(`
        SELECT COALESCE(s.name, 'Sin estado') as status_name, COUNT(*)::int as count
        FROM public.projects p
        LEFT JOIN public.statuses s ON s.status_id = p.status_id
        WHERE 1=1 ${programProjectScope}
        GROUP BY COALESCE(s.name, 'Sin estado')
        ORDER BY count DESC
      `);
      const total = countsRes.rows.reduce((acc, r) => acc + r.count, 0);
      const lines = [`ESTADÍSTICAS DE PROYECTOS POR ESTADO EN ${programName.toUpperCase()} (Total: ${total}):`, ''];
      countsRes.rows.forEach(r => lines.push(`• ${r.status_name}: ${r.count} proyecto(s)`));
      return { message: lines.join('\n'), projects: [] };
    }

    if (/cuantos proyectos existen actualmente|cuantos proyectos existen|total de proyectos/.test(norm)) {
      const totalRes = await pool.query(`
        SELECT COUNT(*)::int as total
        FROM public.projects p
        WHERE 1=1 ${programProjectScope}
      `);
      const total = totalRes.rows[0]?.total || 0;
      return {
        message: `Actualmente existen ${total} proyecto(s) de grado registrados en el sistema para ${programName}.`,
        projects: []
      };
    }

    if (/proyectos estan en ejecucion|en ejecucion/.test(norm)) {
      const activeRes = await pool.query(`
        SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
               s.name as status_name, m.name as modality_name,
               rl.name as line_name, rsl.name as subline_name,
               COALESCE((SELECT json_agg(json_build_object('name', u2.full_name, 'email', u2.email, 'role', up2.project_role))
                         FROM public.user_projects up2 JOIN public.users u2 ON u2.user_id = up2.user_id
                         WHERE up2.project_id = p.project_id), '[]'::json) as participants
        FROM public.projects p
        JOIN public.statuses s ON s.status_id = p.status_id
        LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
        LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
        LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
        WHERE (s.name ILIKE '%curso%' OR s.name ILIKE '%ejecucion%') ${programProjectScope}
        ORDER BY p.created_at DESC
      `);
      const projects = activeRes.rows.map(row => formatChatbookProject(row, false));
      const lines = [`PROYECTOS EN EJECUCIÓN (${projects.length}) EN ${programName.toUpperCase()}:`, ''];
      projects.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title} (${p.line || 'Sin línea'})`));
      return { message: lines.join('\n'), projects };
    }

    if (/proyectos estan terminados|terminados/.test(norm)) {
      const doneRes = await pool.query(`
        SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
               s.name as status_name, m.name as modality_name,
               rl.name as line_name, rsl.name as subline_name,
               COALESCE((SELECT json_agg(json_build_object('name', u2.full_name, 'email', u2.email, 'role', up2.project_role))
                         FROM public.user_projects up2 JOIN public.users u2 ON u2.user_id = up2.user_id
                         WHERE up2.project_id = p.project_id), '[]'::json) as participants
        FROM public.projects p
        JOIN public.statuses s ON s.status_id = p.status_id
        LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
        LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
        LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
        WHERE (s.name ILIKE '%finalizad%' OR s.name ILIKE '%terminad%') ${programProjectScope}
        ORDER BY p.finished_at DESC
      `);
      const projects = doneRes.rows.map(row => formatChatbookProject(row, false));
      const lines = [`PROYECTOS TERMINADOS (${projects.length}) EN ${programName.toUpperCase()}:`, ''];
      projects.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title} (Culminó: ${formatDateCO(p.finishedAt)})`));
      return { message: lines.join('\n'), projects };
    }

    if (/proyectos estan pendientes|pendientes/.test(norm)) {
      const pendRes = await pool.query(`
        SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
               s.name as status_name, m.name as modality_name,
               rl.name as line_name, rsl.name as subline_name,
               COALESCE((SELECT json_agg(json_build_object('name', u2.full_name, 'email', u2.email, 'role', up2.project_role))
                         FROM public.user_projects up2 JOIN public.users u2 ON u2.user_id = up2.user_id
                         WHERE up2.project_id = p.project_id), '[]'::json) as participants
        FROM public.projects p
        JOIN public.statuses s ON s.status_id = p.status_id
        LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
        LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
        LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
        WHERE (s.name ILIKE '%propuest%' OR s.name ILIKE '%radicad%' OR s.name ILIKE '%pendient%') ${programProjectScope}
        ORDER BY p.created_at DESC
      `);
      const projects = pendRes.rows.map(row => formatChatbookProject(row, false));
      const lines = [`PROYECTOS PENDIENTES / EN PROPUESTA (${projects.length}) EN ${programName.toUpperCase()}:`, ''];
      projects.forEach(p => lines.push(`- ${p.code || 'Sin código'} — ${p.title}`));
      return { message: lines.join('\n'), projects };
    }

    if (/proyectos estan disponibles|proyectos disponibles/.test(norm)) {
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
        WHERE (s.name ILIKE '%disponib%' OR s.name ILIKE '%banco%') ${programProjectScope}
        ORDER BY p.created_at DESC
      `);
      const projects = dispRes.rows.map(row => formatChatbookProject(row, false));
      return {
        message: projects.length > 0
          ? `Encontré ${projects.length} proyecto(s) disponible(s) en el Banco de Proyectos de ${programName}:`
          : `No hay proyectos con estado disponible en el Banco de Proyectos de ${programName}.`,
        projects
      };
    }

    if (/muestrame todos los proyectos|todos los proyectos|ver todos los proyectos/.test(norm)) {
      const allRes = await pool.query(`
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
        WHERE 1=1 ${programProjectScope}
        ORDER BY p.created_at DESC LIMIT 25
      `);
      const projects = allRes.rows.map(row => formatChatbookProject(row, false));
      return {
        message: `Encontré ${projects.length} proyectos registrados en ${programName}:`,
        projects
      };
    }

    if (/busca proyectos por modalidad|proyectos por modalidad/.test(norm)) {
      const modRes = await pool.query(`
        SELECT COALESCE(m.name, 'Sin modalidad') as modality_name, COUNT(*)::int as count
        FROM public.projects p
        LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
        WHERE 1=1 ${programProjectScope}
        GROUP BY COALESCE(m.name, 'Sin modalidad')
        ORDER BY count DESC
      `);
      const lines = [`PROYECTOS POR MODALIDAD EN ${programName.toUpperCase()}:`, ''];
      modRes.rows.forEach(r => lines.push(`• ${r.modality_name}: ${r.count} proyecto(s)`));
      return { message: lines.join('\n'), projects: [] };
    }

    // LÍNEAS DE INVESTIGACIÓN (ADMIN)
    if (/que lineas de investigacion existen|lineas de investigacion existen|que lineas existen/.test(norm)) {
      const linesRes = await pool.query(`
        SELECT rl.research_line_id, rl.name, rl.description,
               COALESCE((SELECT json_agg(json_build_object('name', rsl.name, 'description', rsl.description))
                         FROM public.research_sublines rsl WHERE rsl.research_line_id = rl.research_line_id), '[]'::json) as sublines
        FROM public.research_lines rl ORDER BY rl.name
      `);
      const lines = [`LÍNEAS DE INVESTIGACIÓN REGISTRADAS EN ${programName.toUpperCase()} (${linesRes.rows.length}):`, ''];
      linesRes.rows.forEach(l => {
        lines.push(`• ${l.name}: ${l.description || 'Línea de investigación institucional'}`);
        if (l.sublines && l.sublines.length > 0) {
          lines.push(`  Sublíneas: ${l.sublines.map(s => s.name).join(', ')}`);
        }
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: [], lines: linesRes.rows };
    }

    if (/cuantos proyectos tiene cada linea|proyectos tiene cada linea|proyectos por linea|busca proyectos por linea/.test(norm)) {
      const linesCountRes = await pool.query(`
        SELECT rl.name as line_name, COUNT(p.project_id)::int as count
        FROM public.research_lines rl
        LEFT JOIN public.projects p ON p.research_line_id = rl.research_line_id ${programProjectScope}
        GROUP BY rl.name
        ORDER BY count DESC
      `);
      const lines = [`CANTIDAD DE PROYECTOS POR LÍNEA DE INVESTIGACIÓN EN ${programName.toUpperCase()}:`, ''];
      linesCountRes.rows.forEach(r => lines.push(`• ${r.line_name}: ${r.count} proyecto(s)`));
      return { message: lines.join('\n'), projects: [] };
    }

    if (/que sublineas existen|sublineas existen/.test(norm)) {
      const sublinesRes = await pool.query(`
        SELECT rl.name as line_name, rsl.name as subline_name
        FROM public.research_sublines rsl
        JOIN public.research_lines rl ON rl.research_line_id = rsl.research_line_id
        ORDER BY rl.name, rsl.name
      `);
      const grouped = {};
      sublinesRes.rows.forEach(r => {
        if (!grouped[r.line_name]) grouped[r.line_name] = [];
        grouped[r.line_name].push(r.subline_name);
      });
      const lines = [`SUBLÍNEAS DE INVESTIGACIÓN EN ${programName.toUpperCase()}:`, ''];
      Object.entries(grouped).forEach(([lName, sList]) => {
        lines.push(`• ${lName}:`);
        lines.push(`  ${sList.join(', ')}`);
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: [] };
    }

    if (/docentes pertenecen a cada linea|docentes por linea/.test(norm)) {
      const teachersByLineRes = await pool.query(`
        SELECT rl.name as line_name, u.full_name, u.email
        FROM public.projects p
        JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
        JOIN public.user_projects up ON up.project_id = p.project_id
        JOIN public.users u ON u.user_id = up.user_id
        JOIN public.user_roles ur ON ur.user_id = u.user_id
        JOIN public.roles r ON r.role_id = ur.role_id
        WHERE (LOWER(r.name) LIKE '%docent%') ${programProjectScope}
        GROUP BY rl.name, u.full_name, u.email
        ORDER BY rl.name, u.full_name
      `);
      const grouped = {};
      teachersByLineRes.rows.forEach(r => {
        if (!grouped[r.line_name]) grouped[r.line_name] = [];
        grouped[r.line_name].push(`${r.full_name} (${r.email})`);
      });
      const lines = [`DOCENTES POR LÍNEA DE INVESTIGACIÓN EN ${programName.toUpperCase()}:`, ''];
      Object.entries(grouped).forEach(([lName, tList]) => {
        lines.push(`• ${lName} (${tList.length} docentes):`);
        tList.forEach(t => lines.push(`  - ${t}`));
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: [] };
    }

    if (/proyectos estan asociados a cada linea|proyectos asociados a cada linea/.test(norm)) {
      const lineProjectsRes = await pool.query(`
        SELECT rl.name as line_name, p.code, p.title
        FROM public.projects p
        JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
        WHERE 1=1 ${programProjectScope}
        ORDER BY rl.name, p.code
      `);
      const grouped = {};
      lineProjectsRes.rows.forEach(r => {
        if (!grouped[r.line_name]) grouped[r.line_name] = [];
        grouped[r.line_name].push(`${r.code || 'Sin código'} — ${r.title}`);
      });
      const lines = [`PROYECTOS ASOCIADOS A CADA LÍNEA EN ${programName.toUpperCase()}:`, ''];
      Object.entries(grouped).forEach(([lName, pList]) => {
        lines.push(`• ${lName} (${pList.length} proyectos):`);
        pList.forEach(p => lines.push(`  - ${p}`));
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: [] };
    }

    // DOCENTES (ADMIN)
    if (/que docentes existen|que docentes estan registrados|que docentes hay/.test(norm)) {
      const allProfiles = await getAllTeachersWithStats(programId);
      if (allProfiles.length === 0) {
        return { message: `No hay docentes registrados en la base de datos para ${programName}.`, projects: [] };
      }
      const lines = [`DOCENTES REGISTRADOS EN ${programName.toUpperCase()} (${allProfiles.length}):`, ''];
      allProfiles.forEach((p, idx) => {
        const lineStr = p.lines.length > 0 ? p.lines.join(', ') : 'Sin línea asignada';
        lines.push(`${idx + 1}. ${p.teacher.full_name} (${p.teacher.email})`);
        lines.push(`   - Línea(s): ${lineStr}`);
        lines.push(`   - Proyectos: Total ${p.totalProjects} (Asesor: ${p.asesorProjects.length}, Jurado: ${p.juradoProjects.length})`);
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: [] };
    }

    if (/proyectos tiene asignado cada docente|proyectos por docente/.test(norm)) {
      const allProfiles = await getAllTeachersWithStats(programId);
      const lines = [`ASIGNACIÓN DE PROYECTOS POR DOCENTE EN ${programName.toUpperCase()}:`, ''];
      allProfiles.forEach(p => {
        lines.push(`• ${p.teacher.full_name} (${p.teacher.email}):`);
        lines.push(`  Total: ${p.totalProjects} | Asesor: ${p.asesorProjects.length} | Jurado: ${p.juradoProjects.length}`);
        if (p.asesorProjects.length > 0) {
          p.asesorProjects.forEach(proj => lines.push(`  - Asesor: ${proj.code || 'Sin código'} — ${proj.title}`));
        }
        if (p.juradoProjects.length > 0) {
          p.juradoProjects.forEach(proj => lines.push(`  - Jurado: ${proj.code || 'Sin código'} — ${proj.title}`));
        }
        lines.push('');
      });
      return { message: lines.join('\n').trim(), projects: [] };
    }

    if (/docentes tienen proyectos asociados|docentes con proyectos/.test(norm)) {
      const allProfiles = await getAllTeachersWithStats(programId);
      const activeTeachers = allProfiles.filter(p => p.totalProjects > 0);
      const lines = [`DOCENTES CON PROYECTOS ASOCIADOS EN ${programName.toUpperCase()} (${activeTeachers.length}):`, ''];
      activeTeachers.forEach(p => {
        lines.push(`- ${p.teacher.full_name} (${p.teacher.email}): ${p.totalProjects} proyecto(s) (${p.asesorProjects.length} como asesor, ${p.juradoProjects.length} como jurado)`);
      });
      return { message: lines.join('\n'), projects: [] };
    }
  }

  // 4. FALLBACK GENERAL BÚSQUEDA LIBRE
  const values = [];
  const filters = [];

  const cleanSearch = rawText
    .replace(/\b(busca|buscar|muéstrame|muestrame|quiero|información|informacion|proyectos|proyecto|disponibles|disponible|de|sobre|en|la|el|los|las|qué|que|cuál|cual|hay|existen|mis|mi|similares|relacionados|con)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanSearch.length >= 2) {
    values.push(`%${cleanSearch}%`);
    filters.push(`(p.title ILIKE $${values.length} OR p.code ILIKE $${values.length} OR rl.name ILIKE $${values.length} OR rsl.name ILIKE $${values.length} OR m.name ILIKE $${values.length} OR s.name ILIKE $${values.length})`);
  }

  const fallbackRes = await pool.query(`
    SELECT p.project_id, p.title, p.code, p.created_at, p.finished_at,
           s.name AS status_name, m.name AS modality_name,
           rl.name AS line_name, rsl.name AS subline_name,
           COALESCE((SELECT json_agg(json_build_object('name', u.full_name, 'email', u.email, 'program', pr.name, 'role', COALESCE(up.project_role, 'autor')) ORDER BY u.full_name)
                     FROM public.user_projects up JOIN public.users u ON u.user_id = up.user_id
                     LEFT JOIN public.programs pr ON pr.program_id = u.program_id
                     WHERE up.project_id = p.project_id), '[]'::json) AS participants
    FROM public.projects p
    LEFT JOIN public.statuses s ON s.status_id = p.status_id
    LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
    LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
    LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
    WHERE 1=1 ${programProjectScope} ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
    ORDER BY p.created_at DESC LIMIT 20
  `, values);

  const projects = fallbackRes.rows.map(row => formatChatbookProject(row, isStudent));
  return {
    message: projects.length > 0
      ? `Encontré ${projects.length} proyecto(s) relacionados con tu consulta en ${programName}:`
      : `No encontré proyectos que coincidan con tu búsqueda en ${programName}.`,
    projects,
  };
}

// RUN COMPREHENSIVE TEST
async function runAllTests() {
  const adminRes = await pool.query(`SELECT u.user_id, u.full_name, u.email FROM public.users u JOIN public.user_roles ur ON ur.user_id = u.user_id JOIN public.roles r ON r.role_id = ur.role_id WHERE LOWER(r.name) LIKE '%admin%' LIMIT 1`);
  const teacherRes = await pool.query(`SELECT u.user_id, u.full_name, u.email FROM public.users u JOIN public.user_roles ur ON ur.user_id = u.user_id JOIN public.roles r ON r.role_id = ur.role_id WHERE LOWER(r.name) LIKE '%docent%' LIMIT 1`);
  const studentRes = await pool.query(`SELECT u.user_id, u.full_name, u.email FROM public.users u JOIN public.user_roles ur ON ur.user_id = u.user_id JOIN public.roles r ON r.role_id = ur.role_id WHERE LOWER(r.name) LIKE '%estudiant%' LIMIT 1`);

  const admin = adminRes.rows[0];
  const teacher = teacherRes.rows[0];
  const student = studentRes.rows[0];

  const questions = {
    admin: [
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
      '¿Qué docentes tienen proyectos asociados?',
    ],
    docente: [
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
      'Busca proyectos relacionados con esta temática.',
      '¿A qué línea pertenece este proyecto?',
      '¿Qué proyectos existen en mi línea?',
      '¿Qué sublíneas pertenecen a esta línea?',
      '¿Qué docentes pertenecen a esta línea?',
      '¿Qué estudiantes están asociados a mis proyectos?',
    ],
    estudiante: [
      '¿Cuándo inicia mi proyecto?',
      '¿Cuándo termina mi proyecto?',
      '¿Cuánto tiempo dura mi proyecto?',
      '¿Cuánto falta para que termine mi proyecto?',
      '¿Cuáles son las fechas de mis proyectos?',
      '¿Cuál de mis proyectos termina primero?',
      '¿Cuál de mis proyectos está próximo a terminar?',
      '¿Cuál es el estado de mi proyecto?',
      '¿Cuál es el estado de mis proyectos?',
      '¿Qué significa el estado de mi proyecto?',
      '¿Qué proyectos míos están en ejecución?',
      '¿Tengo algún proyecto terminado?',
      '¿Cuáles son mis proyectos?',
      '¿Qué proyectos están disponibles?',
      'Busca proyectos relacionados con mi línea.',
      'Busca proyectos sobre inteligencia artificial.',
      'Muéstrame proyectos similares.',
      '¿Cuál es mi línea de investigación?',
      '¿Cuál es la sublínea de mi proyecto?',
      '¿Qué proyectos existen en mi línea?',
      '¿Qué otras líneas existen?',
      '¿Quién es mi docente asesor?',
      '¿Qué docente está asociado a mi proyecto?',
      '¿Qué docentes pertenecen a mi línea?',
    ]
  };

  for (const [role, list] of Object.entries(questions)) {
    const user = role === 'admin' ? admin : (role === 'docente' ? teacher : student);
    console.log(`\n================= TESTING ROLE: ${role.toUpperCase()} (${user.full_name}) =================`);
    let passCount = 0;
    for (const q of list) {
      const res = await handleChatbookQuery(user.user_id, q);
      const firstLine = (res.message || '').split('\n')[0];
      const isFallback = res.message?.includes('No encontré proyectos que coincidan') || res.message?.includes('No encuentro esta información');
      const statusIcon = isFallback ? '❌ [FALLBACK]' : '✅ [OK]';
      if (!isFallback) passCount++;
      console.log(`${statusIcon} Q: "${q}"\n   ↳ Resp: ${firstLine}`);
    }
    console.log(`Summary: ${passCount}/${list.length} PASSED.`);
  }

  await pool.end();
}

runAllTests();
