import pool from '../server/db.js';

async function checkTeachers() {
  const res = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, r.name as role_name
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE LOWER(r.name) LIKE '%docent%' OR LOWER(r.name) LIKE '%profesor%'
  `);
  console.log('Teachers in DB:', res.rows);
  await pool.end();
}

checkTeachers();
