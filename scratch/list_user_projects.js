import pool from '../server/db.js';

async function listUserProjects() {
  const res = await pool.query(`
    SELECT up.user_project_id, p.code, p.title, u.full_name, u.email, u.program_id, pr.name as program_name, up.project_role
    FROM user_projects up
    JOIN projects p ON p.project_id = up.project_id
    JOIN users u ON u.user_id = up.user_id
    LEFT JOIN programs pr ON pr.program_id = u.program_id
    ORDER BY p.code, u.program_id
  `);
  console.log('ALL USER PROJECTS ASSIGNMENTS:');
  res.rows.forEach(r => console.log(`[${r.code}] ${r.full_name} (${r.program_name || 'Sin prog'}) - Rol: ${r.project_role}`));
  process.exit(0);
}

listUserProjects();
