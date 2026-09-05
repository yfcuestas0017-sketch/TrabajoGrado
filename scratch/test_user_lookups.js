import pool from '../server/db.js';

async function testLookups() {
  const lookups = ['1', 'admin001', 'admin@unicesmag.edu.co', 'ADMIN001', 'Administrador', 'admin', '2', '3'];

  for (const id of lookups) {
    const res = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name AS program_name, COALESCE(r.name, 'usuario') AS role_name
       FROM public.users u
       LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
       LEFT JOIN public.roles r ON r.role_id = ur.role_id
       LEFT JOIN public.programs pr ON pr.program_id = u.program_id
       WHERE u.user_id::text = $1
       LIMIT 1`,
      [id]
    );
    console.log(`Lookup WHERE user_id::text = '${id}' -> Found: ${res.rows.length > 0 ? 'YES: ' + res.rows[0].email + ' (Role: ' + res.rows[0].role_name + ')' : 'NO (403 ERROR)'}`);
  }

  await pool.end();
}

testLookups().catch(console.error);
