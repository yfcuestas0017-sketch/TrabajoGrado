import pool from '../server/db.js';

async function checkDetails() {
  const progs = (await pool.query('SELECT * FROM programs')).rows;
  console.log('PROGRAMS:', progs);

  const lines = (await pool.query('SELECT * FROM research_lines')).rows;
  console.log('ALL RESEARCH LINES IN DB:', lines);

  const pPsi = await pool.query(`
    SELECT p.project_id, p.code, p.title, rl.name as line_name, u.full_name as student_name, pr.name as program_name
    FROM projects p
    JOIN research_lines rl ON rl.research_line_id = p.research_line_id
    JOIN user_projects up ON up.project_id = p.project_id
    JOIN users u ON u.user_id = up.user_id
    JOIN programs pr ON pr.program_id = u.program_id
    WHERE u.program_id = 6
  `);
  console.log('\nPROJECTS OF PSICOLOGÍA (Program 6):');
  pPsi.rows.forEach(r => console.log(`- [${r.code}] ${r.title} | Línea: ${r.line_name} | Estudiante: ${r.student_name}`));

  const pSis = await pool.query(`
    SELECT p.project_id, p.code, p.title, rl.name as line_name, u.full_name as student_name, pr.name as program_name
    FROM projects p
    JOIN research_lines rl ON rl.research_line_id = p.research_line_id
    JOIN user_projects up ON up.project_id = p.project_id
    JOIN users u ON u.user_id = up.user_id
    JOIN programs pr ON pr.program_id = u.program_id
    WHERE u.program_id = 1
  `);
  console.log('\nPROJECTS OF SISTEMAS (Program 1):');
  pSis.rows.forEach(r => console.log(`- [${r.code}] ${r.title} | Línea: ${r.line_name} | Estudiante: ${r.student_name}`));

  process.exit(0);
}

checkDetails();
