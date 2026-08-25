import pool from '../server/db.js';

async function testStudentRestrictions() {
  const usersRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name as program_name
    FROM users u
    LEFT JOIN programs pr ON pr.program_id = u.program_id
  `);

  const magda = usersRes.rows.find(u => u.email === 'mcagreda.4846@unicesmag.edu.co'); // Estudiante Psicología
  const vanessa = usersRes.rows.find(u => u.email === 'vkcriollo.5274@unicesmag.edu.co'); // Estudiante Sistemas

  const studentQueries = [
    '¿Cuándo inicia mi proyecto?',
    '¿Cuándo termina mi proyecto?',
    '¿Quién es mi docente asesor?',
    '¿Qué docentes pertenecen a mi línea?',
    '¿Quién es Francisco?',
    '¿Cuál es el estado de mis proyectos?',
    '¿Cuáles son mis proyectos?',
    '¿Cuál es mi línea de investigación?',
  ];

  console.log('--- TESTING STUDENT RESTRICTIONS ---');

  for (const student of [magda, vanessa]) {
    console.log(`\nUser: ${student.full_name} (${student.program_name})`);
    for (const q of studentQueries) {
      const resp = await (await fetch('http://localhost:5000/api/chatbook/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: student.user_id, message: q })
      })).json();

      console.log(`Q: "${q}" -> Message: "${resp.message}"`);
    }
  }

  process.exit(0);
}

testStudentRestrictions().catch(err => {
  console.error(err);
  process.exit(1);
});
