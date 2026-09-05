const { pool } = require('../server/db');

// Let's draft and test the degree options logic
async function queryDegreeOptions(norm, rawText, programId, programName, programProjectScope) {
  // 1. Fetch degree options from DB
  const degOptsRes = await pool.query('SELECT degree_option_id, name, description FROM public.degree_options ORDER BY degree_option_id');
  const degreeOptions = degOptsRes.rows;

  // 2. Fetch projects and user projects in scope
  const projectsRes = await pool.query(`
    SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
           p.degree_option_id, dopt.name as degree_option_name,
           s.name as status_name, rl.name as line_name,
           EXTRACT(YEAR FROM p.created_at)::int as year,
           COALESCE((
             SELECT json_agg(json_build_object('name', u.full_name, 'role', up.project_role, 'program_id', u.program_id))
             FROM public.user_projects up JOIN public.users u ON u.user_id = up.user_id
             WHERE up.project_id = p.project_id AND (up.project_role = 'autor' OR up.project_role = 'coautor' OR up.project_role IS NULL)
           ), '[]'::json) as authors
    FROM public.projects p
    LEFT JOIN public.degree_options dopt ON dopt.degree_option_id = p.degree_option_id
    LEFT JOIN public.statuses s ON s.status_id = p.status_id
    LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
    WHERE 1=1 ${programProjectScope}
  `);
  const projects = projectsRes.rows;

  return { degreeOptions, projects };
}

async function run() {
  const data = await queryDegreeOptions('opciones de grado', '¿Qué opciones de grado existen?', 1, 'Ingeniería de Sistemas', `AND (EXISTS (SELECT 1 FROM public.user_projects up_pr JOIN public.users u_pr ON u_pr.user_id = up_pr.user_id WHERE up_pr.project_id = p.project_id AND u_pr.program_id = 1 AND (up_pr.project_role = 'autor' OR up_pr.project_role = 'coautor' OR up_pr.project_role IS NULL)))`);
  console.log('Result:', data);
  pool.end();
}

run();
