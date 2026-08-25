import pool from '../server/db.js';

async function checkAllTables() {
  const res = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log('ALL PUBLIC TABLES:', res.rows.map(r => r.table_name));

  // Also check if projects are linked to programs via user_projects -> users
  const prjSample = await pool.query(`
    SELECT p.project_id, p.title, p.code, u.user_id, u.full_name, u.program_id, pr.name as program_name, up.project_role
    FROM projects p
    LEFT JOIN user_projects up ON up.project_id = p.project_id
    LEFT JOIN users u ON u.user_id = up.user_id
    LEFT JOIN programs pr ON pr.program_id = u.program_id
    LIMIT 10
  `);
  console.log('SAMPLE PROJECT-PROGRAM RELATIONS:', prjSample.rows);

  // Check lines distribution across programs
  const linesByProg = await pool.query(`
    SELECT pr.name as program_name, rl.name as line_name, COUNT(p.project_id) as count
    FROM research_lines rl
    JOIN projects p ON p.research_line_id = rl.research_line_id
    JOIN user_projects up ON up.project_id = p.project_id
    JOIN users u ON u.user_id = up.user_id
    JOIN programs pr ON pr.program_id = u.program_id
    GROUP BY pr.name, rl.name
  `);
  console.log('LINES BY PROGRAM VIA PROJECTS:', linesByProg.rows);

  process.exit(0);
}

checkAllTables().catch(err => {
  console.error(err);
  process.exit(1);
});
