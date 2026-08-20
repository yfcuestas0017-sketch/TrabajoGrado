import pool from '../server/db.js';

async function check() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Tables in public schema:', res.rows.map(r => r.table_name).join(', '));
    
    const semCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='semesters'");
    console.log('Semesters columns:', semCols.rows.map(c => c.column_name).join(', '));

    const projCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='projects'");
    console.log('Projects columns:', projCols.rows.map(c => c.column_name).join(', '));

    const upCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='user_projects'");
    console.log('User_projects columns:', upCols.rows.map(c => c.column_name).join(', '));

    process.exit(0);
  } catch (err) {
    console.error('DB Check error:', err);
    process.exit(1);
  }
}

check();
