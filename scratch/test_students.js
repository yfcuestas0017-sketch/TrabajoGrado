import pool from '../server/db.js';

async function testStudents() {
  const usersRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name as program_name
    FROM users u
    LEFT JOIN programs pr ON pr.program_id = u.program_id
  `);

  const magda = usersRes.rows.find(u => u.email === 'mcagreda.4846@unicesmag.edu.co');
  const vanessa = usersRes.rows.find(u => u.email === 'vkcriollo.5274@unicesmag.edu.co');

  const qMagda = await (await fetch('http://localhost:5000/api/chatbook/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: magda.user_id, message: '¿Cuáles son mis proyectos?' })
  })).json();

  const qVanessa = await (await fetch('http://localhost:5000/api/chatbook/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: vanessa.user_id, message: '¿Cuáles son mis proyectos?' })
  })).json();

  console.log('--- MAGDA (Psicología) ---');
  console.log('Projects:', qMagda.projects?.map(p => `[${p.code}] ${p.title} (${p.line})`));

  console.log('\n--- VANESSA (Ingeniería de Sistemas) ---');
  console.log('Projects:', qVanessa.projects?.map(p => `[${p.code}] ${p.title} (${p.line})`));

  process.exit(0);
}

testStudents();
