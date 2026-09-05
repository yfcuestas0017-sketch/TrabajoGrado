import pool from '../server/db.js';

async function inspect() {
  console.log('=== ROLES IN DATABASE ===');
  const roles = await pool.query('SELECT * FROM public.roles ORDER BY role_id');
  console.log(roles.rows);

  console.log('\n=== USERS AND THEIR ROLES IN DATABASE ===');
  const users = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id,
           ur.role_id as ur_role_id, r.role_id, r.name as role_name
    FROM public.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
    LEFT JOIN public.roles r ON r.role_id = ur.role_id
    ORDER BY u.user_id
  `);
  console.log(users.rows);

  console.log('\n=== SIMULATING QUERY IN server/index.js (LÍNEA 2034) FOR EACH USER ===');
  for (const u of users.rows) {
    const accessRes = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name AS program_name, COALESCE(r.name, 'usuario') AS role_name
       FROM public.users u
       LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
       LEFT JOIN public.roles r ON r.role_id = ur.role_id
       LEFT JOIN public.programs pr ON pr.program_id = u.program_id
       WHERE u.user_id::text = $1
       LIMIT 1`,
      [String(u.user_id)]
    );
    console.log(`User ID: "${u.user_id}" (${u.email}) -> Found rows: ${accessRes.rows.length}, Role Name: "${accessRes.rows[0]?.role_name}"`);
  }

  await pool.end();
}

inspect().catch(console.error);
