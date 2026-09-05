import pool from '../server/db.js';

async function main() {
  const users = await pool.query(`
    SELECT DISTINCT u.user_id, u.full_name, u.email, u.program_id, p.name as program_name, r.name as role_name
    FROM public.users u
    LEFT JOIN public.programs p ON u.program_id = p.program_id
    LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN public.roles r ON ur.role_id = r.role_id
    WHERE LOWER(COALESCE(r.name, '')) IN ('docente', 'profesor')
       OR u.user_id ILIKE 'doc%'
       OR u.email ILIKE '%docente%'
    ORDER BY u.program_id, u.user_id
  `);
  console.log(`Encontrados ${users.rows.length} docentes:`);
  console.table(users.rows);

  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('Tablas en base de datos:');
  console.log(tables.rows.map(t => t.table_name).join(', '));

  await pool.end();
}

main().catch(console.error);
