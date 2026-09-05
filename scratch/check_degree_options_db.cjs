const { pool } = require('../server/db');

async function check() {
  try {
    const degOpts = await pool.query('SELECT * FROM public.degree_options ORDER BY degree_option_id');
    console.log('Degree options in DB:');
    console.table(degOpts.rows);

    const counts = await pool.query(`
      SELECT dopt.degree_option_id,
             COALESCE(dopt.name, 'Sin opción asignada') as option_name,
             COUNT(p.project_id) as total_projects,
             COUNT(DISTINCT up.user_id) as total_students
      FROM public.degree_options dopt
      LEFT JOIN public.projects p ON p.degree_option_id = dopt.degree_option_id
      LEFT JOIN public.user_projects up ON up.project_id = p.project_id
      GROUP BY dopt.degree_option_id, dopt.name
      ORDER BY dopt.degree_option_id
    `);
    console.log('Project & Student distribution:');
    console.table(counts.rows);

    const totalProjects = await pool.query('SELECT count(*) FROM public.projects');
    console.log('Total projects in DB:', totalProjects.rows[0].count);

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
