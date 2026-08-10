import pool from '../server/db.js';

async function checkTypes() {
  const columns = await pool.query(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name IN ('users', 'roles', 'user_roles', 'permissions', 'role_permissions', 'projects', 'user_projects', 'students', 'statuses', 'modalities', 'research_lines', 'research_sublines')
    ORDER BY table_name, column_name;
  `);

  console.table(columns.rows);
  process.exit(0);
}

checkTypes().catch(err => {
  console.error(err);
  process.exit(1);
});
