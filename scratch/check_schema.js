import pool from '../server/db.js';

async function checkSchema() {
  const tables = ['programs', 'research_lines', 'research_sublines', 'projects', 'users', 'user_projects', 'user_roles', 'roles'];
  for (const t of tables) {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [t]);
    console.log('TABLE:', t, res.rows.map(r => r.column_name).join(', '));
  }
  const progs = await pool.query('SELECT program_id, name FROM public.programs');
  console.log('PROGRAMS in DB:', progs.rows);
  process.exit(0);
}

checkSchema().catch(err => {
  console.error(err);
  process.exit(1);
});
