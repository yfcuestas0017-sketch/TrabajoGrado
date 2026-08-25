import pool from '../server/db.js';

async function testProgramFilter() {
  const users = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name as program_name, r.name as role_name
    FROM public.users u
    LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
    LEFT JOIN public.roles r ON r.role_id = ur.role_id
    ORDER BY u.program_id, r.name
  `);
  console.log('=== USERS ===');
  console.table(users.rows);

  await pool.end();
}

testProgramFilter().catch(console.error);
