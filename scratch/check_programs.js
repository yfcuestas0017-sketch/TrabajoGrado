import pool from '../server/db.js';

async function checkProgramsAndLines() {
  const progs = await pool.query('SELECT program_id, name FROM public.programs ORDER BY program_id');
  console.log('=== PROGRAMS ===');
  console.table(progs.rows);

  const lines = await pool.query('SELECT research_line_id, name FROM public.research_lines ORDER BY research_line_id');
  console.log('=== RESEARCH LINES ===');
  console.table(lines.rows);

  const usersByProg = await pool.query(`
    SELECT u.program_id, pr.name as program_name, r.name as role_name, COUNT(*) as count
    FROM public.users u
    LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
    LEFT JOIN public.roles r ON r.role_id = ur.role_id
    GROUP BY u.program_id, pr.name, r.name
    ORDER BY u.program_id, r.name
  `);
  console.log('=== USERS BY PROGRAM AND ROLE ===');
  console.table(usersByProg.rows);

  const projectsByProg = await pool.query(`
    SELECT 
      COALESCE(u.program_id::text, 'Sin programa') as author_program_id,
      COALESCE(pr.name, 'Sin programa') as program_name,
      COUNT(DISTINCT p.project_id) as project_count
    FROM public.projects p
    LEFT JOIN public.user_projects up ON up.project_id = p.project_id AND (up.project_role = 'autor' OR up.project_role = 'coautor' OR up.project_role IS NULL)
    LEFT JOIN public.users u ON u.user_id = up.user_id
    LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    GROUP BY u.program_id, pr.name
  `);
  console.log('=== PROJECTS BY AUTHOR PROGRAM ===');
  console.table(projectsByProg.rows);

  await pool.end();
}

checkProgramsAndLines().catch(console.error);
