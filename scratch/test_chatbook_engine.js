import pool from '../server/db.js';

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
  return `Estado: ${statusName}. El proyecto se encuentra registrado activamente en el sistema.`;
}

// Test against test questions
async function run() {
  const student = (await pool.query("SELECT u.user_id, u.full_name, u.program_id, pr.name as program_name FROM public.users u LEFT JOIN public.programs pr ON pr.program_id = u.program_id WHERE u.user_id = '3fd36425-d73c-4887-b5ec-0853f999333a'")).rows[0];
  console.log('Testing with student:', student.full_name, `(${student.program_name})`);

  // Test question: ¿Cuándo inicia mi proyecto?
  const myProjects = (await pool.query(`
    SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
           s.name as status_name, rl.name as line_name, rsl.name as subline_name,
           (SELECT json_agg(json_build_object('name', u2.full_name, 'email', u2.email, 'role', up2.project_role))
            FROM public.user_projects up2 JOIN public.users u2 ON u2.user_id = up2.user_id
            WHERE up2.project_id = p.project_id) as participants
    FROM public.user_projects up
    JOIN public.projects p ON p.project_id = up.project_id
    LEFT JOIN public.statuses s ON s.status_id = p.status_id
    LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
    LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
    WHERE up.user_id = $1
    ORDER BY p.created_at DESC
  `, [student.user_id])).rows;

  console.log(`Found ${myProjects.length} project(s) for student.`);
  for (const p of myProjects) {
    console.log(`- ${p.code} (${p.title}): Inicia: ${formatDateCO(p.created_at)} | Termina: ${formatDateCO(p.finished_at)} | Estado: ${p.status_name} | Restante: ${getRemainingTime(p.finished_at)}`);
  }

  await pool.end();
}

run().catch(console.error);
