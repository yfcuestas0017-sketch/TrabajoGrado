import pool from '../server/db.js';

async function test() {
  const p = await pool.query('SELECT project_id, title FROM public.projects LIMIT 1');
  const proj = p.rows[0];
  console.log('Testing history on project:', proj.project_id);
  const hist = await pool.query(`
    SELECT 
      h.history_id, 
      h.description, 
      h.user_id,
      u.full_name AS user_name,
      u.email AS user_email,
      u.program_id,
      p.name AS program_name,
      COALESCE(r.name, 'Usuario') AS user_role
    FROM public.histories h
    LEFT JOIN public.users u ON u.user_id::text = h.user_id::text
    LEFT JOIN public.programs p ON p.program_id = u.program_id
    LEFT JOIN public.user_roles ur ON ur.user_id::text = u.user_id::text
    LEFT JOIN public.roles r ON r.role_id = ur.role_id
    JOIN public.project_histories ph ON ph.history_id = h.history_id
    WHERE ph.project_id = $1
    ORDER BY h.changed_at DESC LIMIT 3;
  `, [proj.project_id]);
  console.log('Project history records:', JSON.stringify(hist.rows, null, 2));
  await pool.end();
}
test().catch(console.error);
