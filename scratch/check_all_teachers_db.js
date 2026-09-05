import pool from '../server/db.js';

async function checkTeachers() {
  console.log('=== TODOS LOS USUARIOS Y ROLES EN LA BD ===');
  const allUsers = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name as program_name, r.role_id, r.name as role_name
    FROM public.users u
    LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN public.roles r ON ur.role_id = r.role_id
    LEFT JOIN public.programs pr ON u.program_id = pr.program_id
    ORDER BY u.program_id, u.user_id;
  `);
  console.table(allUsers.rows);

  console.log('\n=== USUARIOS CON ROL DOCENTE O PROFESOR O SIN ROL ===');
  const teachers = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name as program_name, r.role_id, r.name as role_name
    FROM public.users u
    LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN public.roles r ON ur.role_id = r.role_id
    LEFT JOIN public.programs pr ON u.program_id = pr.program_id
    WHERE LOWER(COALESCE(r.name, '')) LIKE '%docent%' 
       OR LOWER(COALESCE(r.name, '')) LIKE '%profesor%'
       OR r.name IS NULL
    ORDER BY u.program_id, u.user_id;
  `);
  console.table(teachers.rows);

  await pool.end();
}

checkTeachers().catch(err => {
  console.error(err);
  process.exit(1);
});
