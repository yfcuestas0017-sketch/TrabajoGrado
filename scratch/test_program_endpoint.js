import pool from '../server/db.js';

// Simulate endpoint logic directly with current implementation
async function testEndpoint() {
  const usersRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name as program_name, r.name as role_name
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.user_id
    JOIN roles r ON r.role_id = ur.role_id
    LEFT JOIN programs pr ON pr.program_id = u.program_id
  `);
  
  const magda = usersRes.rows.find(u => u.email === 'mcagreda.4846@unicesmag.edu.co'); // Psicología
  const vanessa = usersRes.rows.find(u => u.email === 'vkcriollo.5274@unicesmag.edu.co'); // Sistemas
  const adminPsi = usersRes.rows.find(u => u.email === 'adminpsi@unicesmag.edu.co'); // Admin Psicología
  const adminSis = usersRes.rows.find(u => u.email === 'admin@unicesmag.edu.co'); // Admin Sistemas

  console.log('Test Users:');
  console.log('Magda (Psico):', magda?.full_name, magda?.user_id);
  console.log('Vanessa (Sistemas):', vanessa?.full_name, vanessa?.user_id);
  console.log('Admin Psi:', adminPsi?.full_name, adminPsi?.user_id);
  console.log('Admin Sis:', adminSis?.full_name, adminSis?.user_id);

  const testCases = [
    { user: magda, query: 'muéstrame los proyectos de Ingeniería de Sistemas', expectedBlock: true },
    { user: magda, query: 'proyectos de ingenieria', expectedBlock: true },
    { user: magda, query: 'proyectos de sistemas', expectedBlock: true },
    { user: magda, query: '¿Cuál es la información del proyecto P-001?', expectedBlock: true }, // P-001 is Sistemas
    { user: magda, query: '¿Cuál es la información del proyecto P-005?', expectedBlock: false }, // P-005 is Psicología
    { user: magda, query: '¿Quién es Darwin Burbano?', expectedBlock: true }, // Darwin is Sistemas
    { user: magda, query: '¿Quién es Francisco?', expectedBlock: false }, // Francisco is Psicología
    { user: magda, query: '¿Cuáles son mis proyectos?', expectedBlock: false },
    { user: vanessa, query: 'muéstrame los proyectos de psicología', expectedBlock: true },
    { user: vanessa, query: '¿Cuál es la información del proyecto P-005?', expectedBlock: true }, // P-005 is Psicología
    { user: vanessa, query: '¿Cuál es la información del proyecto P-004?', expectedBlock: false }, // P-004 is Sistemas
    { user: vanessa, query: '¿Quién es Darwin Burbano?', expectedBlock: false }, // Darwin is Sistemas
    { user: vanessa, query: '¿Quién es Francisco?', expectedBlock: true }, // Francisco is Psicología
    { user: adminPsi, query: '¿Cuántos proyectos existen actualmente?', expectedCount: 7 }, // Psicología has 7
    { user: adminSis, query: '¿Cuántos proyectos existen actualmente?', expectedCount: 17 }, // Sistemas has 17
    { user: adminPsi, query: '¿Cuántos proyectos tiene cada línea?', expectedBlock: false },
  ];

  // We can query the local express server via fetch
  let passed = 0;
  for (const tc of testCases) {
    try {
      const resp = await fetch('http://localhost:5000/api/chatbook/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: tc.user.user_id, message: tc.query })
      });
      const data = await resp.json();
      const isBlocked = data.message?.includes('pertenece a otro programa académico');
      
      let ok = true;
      if (tc.expectedBlock !== undefined) {
        ok = (isBlocked === tc.expectedBlock);
      }
      if (tc.expectedCount !== undefined) {
        ok = ok && data.message?.includes(String(tc.expectedCount));
      }

      console.log(`[${ok ? 'PASS' : 'FAIL'}] User: ${tc.user.full_name} (${tc.user.program_name}) | Query: "${tc.query}"`);
      if (!ok) {
        console.log('   Response:', data.message);
      } else {
        passed++;
      }
    } catch (e) {
      console.log(`[ERROR] User: ${tc.user.full_name} | Query: "${tc.query}" ->`, e.message);
    }
  }

  console.log(`\nResults: ${passed}/${testCases.length} tests passed.`);
  process.exit(0);
}

testEndpoint().catch(err => {
  console.error(err);
  process.exit(1);
});
