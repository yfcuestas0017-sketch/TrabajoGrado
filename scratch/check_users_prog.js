import pool from '../server/db.js';

async function testProgramIsolation() {
  const usersRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name as program_name, r.name as role_name
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.user_id
    JOIN roles r ON r.role_id = ur.role_id
    LEFT JOIN programs pr ON pr.program_id = u.program_id
    ORDER BY u.program_id, r.name
  `);
  console.log('USERS BY PROGRAM & ROLE:');
  usersRes.rows.forEach(u => {
    console.log(`[${u.program_name || 'Sin prog'}] (${u.role_name}) ${u.full_name} (${u.email}) - ID: ${u.user_id}`);
  });

  process.exit(0);
}

testProgramIsolation();
