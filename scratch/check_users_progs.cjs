const { pool } = require('../server/db');

async function testPrograms() {
  try {
    const users = await pool.query(`
      SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name as program_name, r.name as role_name
      FROM public.users u
      LEFT JOIN public.programs pr ON pr.program_id = u.program_id
      LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN public.roles r ON r.role_id = ur.role_id
    `);
    console.log('Users:');
    console.table(users.rows);

    const projs = await pool.query(`
      SELECT p.project_id, p.code, p.title, p.degree_option_id, dopt.name as deg_name,
             u.program_id, pr.name as prog_name
      FROM public.projects p
      LEFT JOIN public.degree_options dopt ON dopt.degree_option_id = p.degree_option_id
      LEFT JOIN public.user_projects up ON up.project_id = p.project_id
      LEFT JOIN public.users u ON u.user_id = up.user_id
      LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    `);
    console.log('Projects with authors:');
    console.table(projs.rows);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

testPrograms();
