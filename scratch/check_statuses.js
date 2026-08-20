import pool from '../server/db.js';

async function checkData() {
  const statuses = await pool.query('SELECT status_id, name FROM public.statuses');
  console.log('Statuses:', statuses.rows);

  const projects = await pool.query(`
    SELECT p.project_id, p.title, s.name as status_name 
    FROM public.projects p 
    LEFT JOIN public.statuses s ON s.status_id = p.status_id
  `);
  console.log('Projects with status:', projects.rows);
  await pool.end();
}

checkData();
