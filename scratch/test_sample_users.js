import pool from '../server/db.js';

// We will test all intent handlers with real database calls
async function test() {
  console.log('Testing queries...');
  // 1. Get sample student from Ingenieria
  const studentIng = (await pool.query("SELECT u.user_id, u.full_name, u.program_id FROM public.users u JOIN public.user_roles ur ON ur.user_id = u.user_id JOIN public.roles r ON r.role_id = ur.role_id WHERE LOWER(r.name) LIKE '%estudiant%' AND u.program_id = 1 LIMIT 1")).rows[0];
  console.log('Student Ing:', studentIng);

  // 2. Get sample student from Psicologia
  const studentPsi = (await pool.query("SELECT u.user_id, u.full_name, u.program_id FROM public.users u JOIN public.user_roles ur ON ur.user_id = u.user_id JOIN public.roles r ON r.role_id = ur.role_id WHERE LOWER(r.name) LIKE '%estudiant%' AND u.program_id = 6 LIMIT 1")).rows[0];
  console.log('Student Psi:', studentPsi);

  // 3. Get sample teacher from Ingenieria
  const teacherIng = (await pool.query("SELECT u.user_id, u.full_name, u.program_id FROM public.users u JOIN public.user_roles ur ON ur.user_id = u.user_id JOIN public.roles r ON r.role_id = ur.role_id WHERE LOWER(r.name) LIKE '%docent%' AND u.program_id = 1 LIMIT 1")).rows[0];
  console.log('Teacher Ing:', teacherIng);

  // 4. Get sample admin from Ingenieria
  const adminIng = (await pool.query("SELECT u.user_id, u.full_name, u.program_id FROM public.users u JOIN public.user_roles ur ON ur.user_id = u.user_id JOIN public.roles r ON r.role_id = ur.role_id WHERE LOWER(r.name) LIKE '%admin%' AND u.program_id = 1 LIMIT 1")).rows[0];
  console.log('Admin Ing:', adminIng);

  // 5. Get sample admin from Psicologia
  const adminPsi = (await pool.query("SELECT u.user_id, u.full_name, u.program_id FROM public.users u JOIN public.user_roles ur ON ur.user_id = u.user_id JOIN public.roles r ON r.role_id = ur.role_id WHERE LOWER(r.name) LIKE '%admin%' AND u.program_id = 6 LIMIT 1")).rows[0];
  console.log('Admin Psi:', adminPsi);

  await pool.end();
}

test().catch(console.error);
