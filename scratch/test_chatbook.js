import pool from '../server/db.js';

async function run() {
  try {
    console.log('Testing DB connection...');
    const users = await pool.query('SELECT user_id, full_name, email FROM public.users LIMIT 5');
    console.log('Users:', users.rows);

    const roles = await pool.query('SELECT ur.user_id, r.name as role_name FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.role_id');
    console.log('User roles:', roles.rows);

    const projects = await pool.query('SELECT project_id, title, code FROM public.projects LIMIT 5');
    console.log('Projects:', projects.rows);

    const lines = await pool.query('SELECT research_line_id, name FROM public.research_lines LIMIT 5');
    console.log('Lines:', lines.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
