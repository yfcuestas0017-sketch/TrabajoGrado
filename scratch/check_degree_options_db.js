const { pool } = require('../server/db');

async function check() {
  try {
    const degOpts = await pool.query('SELECT * FROM public.degree_options');
    console.log('Degree options in DB:');
    console.table(degOpts.rows);

    const projectsWithDopt = await pool.query(`
      SELECT p.project_id, p.title, p.code, p.created_at, p.degree_option_id, dopt.name as degree_option_name,
             p.research_line_id, rl.name as line_name, s.name as status_name
      FROM public.projects p
      LEFT JOIN public.degree_options dopt ON dopt.degree_option_id = p.degree_option_id
      LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
      LEFT JOIN public.statuses s ON s.status_id = p.status_id
      LIMIT 15
    `);
    console.log('Sample projects with degree option:');
    console.table(projectsWithDopt.rows);

    const counts = await pool.query(`
      SELECT COALESCE(dopt.name, 'Sin opción asignada') as option_name,
             COUNT(p.project_id) as total_projects,
             COUNT(DISTINCT up.user_id) as total_students
      FROM public.projects p
      LEFT JOIN public.degree_options dopt ON dopt.degree_option_id = p.degree_option_id
      LEFT JOIN public.user_projects up ON up.project_id = p.project_id
      GROUP BY dopt.name
      ORDER BY total_projects DESC
    `);
    console.log('Project & Student distribution:');
    console.table(counts.rows);

    const years = await pool.query(`
      SELECT EXTRACT(YEAR FROM p.created_at)::int as year,
             COALESCE(dopt.name, 'Sin opción asignada') as option_name,
             COUNT(p.project_id) as count
      FROM public.projects p
      LEFT JOIN public.degree_options dopt ON dopt.degree_option_id = p.degree_option_id
      WHERE p.created_at IS NOT NULL
      GROUP BY year, option_name
      ORDER BY year DESC, count DESC
    `);
    console.log('Distribution by year:');
    console.table(years.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

check();
