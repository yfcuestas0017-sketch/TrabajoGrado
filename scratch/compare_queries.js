import pool from '../server/db.js';

async function compareAllQueries() {
  const usersRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name as program_name, r.name as role_name
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.user_id
    JOIN roles r ON r.role_id = ur.role_id
    LEFT JOIN programs pr ON pr.program_id = u.program_id
  `);

  const magda = usersRes.rows.find(u => u.email === 'mcagreda.4846@unicesmag.edu.co'); // Estudiante Psicología
  const vanessa = usersRes.rows.find(u => u.email === 'vkcriollo.5274@unicesmag.edu.co'); // Estudiante Sistemas
  const adminPsi = usersRes.rows.find(u => u.email === 'adminpsi@unicesmag.edu.co'); // Admin Psicología
  const adminSis = usersRes.rows.find(u => u.email === 'admin@unicesmag.edu.co'); // Admin Sistemas
  const docPsi = usersRes.rows.find(u => u.email === 'francisco@unicesmag.edu.co'); // Docente Psicología
  const docSis = usersRes.rows.find(u => u.email === 'ddburbano.3586@unicesmag.edu.co'); // Docente Sistemas

  const adminQuestions = [
    '¿Qué proyectos están próximos a terminar?',
    '¿Qué proyectos comenzaron recientemente?',
    '¿Cuántos proyectos terminan este mes?',
    '¿Cuáles son las fechas de los proyectos?',
    'Muéstrame proyectos por fecha de finalización.',
    '¿Cuántos proyectos existen por estado?',
    '¿Qué proyectos están en ejecución?',
    '¿Qué proyectos están terminados?',
    '¿Qué proyectos están pendientes?',
    '¿Qué proyectos están disponibles?',
    '¿Cuántos proyectos existen actualmente?',
    'Muéstrame todos los proyectos.',
    'Busca proyectos por estado.',
    'Busca proyectos por modalidad.',
    '¿Qué líneas de investigación existen?',
    '¿Cuántos proyectos tiene cada línea?',
    '¿Qué sublíneas existen?',
    '¿Qué docentes pertenecen a cada línea?',
    '¿Qué proyectos están asociados a cada línea?',
    '¿Qué docentes existen?',
    '¿Qué proyectos tiene asignado cada docente?',
    '¿Qué docentes tienen proyectos asociados?'
  ];

  console.log('=== COMPARISON: ADMIN PSICOLOGÍA VS ADMIN SISTEMAS ===\n');

  for (const q of adminQuestions) {
    const rPsi = await (await fetch('http://localhost:5000/api/chatbook/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: adminPsi.user_id, message: q })
    })).json();

    const rSis = await (await fetch('http://localhost:5000/api/chatbook/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: adminSis.user_id, message: q })
    })).json();

    const psiProjects = rPsi.projects?.map(p => p.code).join(',') || (rPsi.stats?.map(s => `${s.label}:${s.value}`).join(', ')) || rPsi.message?.substring(0, 50);
    const sisProjects = rSis.projects?.map(p => p.code).join(',') || (rSis.stats?.map(s => `${s.label}:${s.value}`).join(', ')) || rSis.message?.substring(0, 50);

    const isDifferent = JSON.stringify(rPsi) !== JSON.stringify(rSis);
    console.log(`Q: "${q}"`);
    console.log(`   [Psicología] -> ${psiProjects}`);
    console.log(`   [Sistemas]   -> ${sisProjects}`);
    console.log(`   Result: ${isDifferent ? 'DIFFERENT (CORRECT)' : 'SAME (ISSUE!)'}\n`);
  }

  process.exit(0);
}

compareAllQueries().catch(err => {
  console.error(err);
  process.exit(1);
});
