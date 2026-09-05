const { pool } = require('../server/db');

async function inspectAll() {
  try {
    const degOpts = await pool.query('SELECT * FROM public.degree_options ORDER BY degree_option_id');
    console.log('--- DEGREE OPTIONS ---');
    console.log(JSON.stringify(degOpts.rows, null, 2));

    const projs = await pool.query(`
      SELECT p.project_id, p.code, p.title, p.created_at, p.degree_option_id, dopt.name as degree_option_name,
             s.name as status_name, rl.name as line_name,
             (SELECT json_agg(json_build_object('name', u.full_name, 'role', up.project_role))
              FROM public.user_projects up JOIN public.users u ON u.user_id = up.user_id
              WHERE up.project_id = p.project_id) as users
      FROM public.projects p
      LEFT JOIN public.degree_options dopt ON dopt.degree_option_id = p.degree_option_id
      LEFT JOIN public.statuses s ON s.status_id = p.status_id
      LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
    `);
    console.log('--- ALL PROJECTS WITH DEGREE OPTION ---');
    console.log(JSON.stringify(projs.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

inspectAll();
