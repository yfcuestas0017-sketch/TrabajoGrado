import pool from '../server/db.js';

async function checkProjectsByProg() {
  const p1 = await pool.query(`
    SELECT p.project_id, p.code, p.title
    FROM projects p
    WHERE EXISTS (
      SELECT 1 FROM user_projects up 
      JOIN users u ON u.user_id = up.user_id 
      WHERE up.project_id = p.project_id AND u.program_id = 1
      AND (up.project_role = 'autor' OR up.project_role = 'coautor' OR up.project_role IS NULL)
    )
  `);
  console.log('PROGRAM 1 (Sistemas) Projects Count:', p1.rows.length);

  const p6 = await pool.query(`
    SELECT p.project_id, p.code, p.title
    FROM projects p
    WHERE EXISTS (
      SELECT 1 FROM user_projects up 
      JOIN users u ON u.user_id = up.user_id 
      WHERE up.project_id = p.project_id AND u.program_id = 6
      AND (up.project_role = 'autor' OR up.project_role = 'coautor' OR up.project_role IS NULL)
    )
  `);
  console.log('PROGRAM 6 (Psicologia) Projects Count:', p6.rows.length);
  console.log('PROGRAM 6 Projects:', p6.rows);

  process.exit(0);
}

checkProjectsByProg();
