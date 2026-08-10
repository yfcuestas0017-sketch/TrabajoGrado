import pool from '../server/db.js';

async function checkDefaults() {
  const res = await pool.query(`
    SELECT column_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'user_id';
  `);
  console.table(res.rows);
  process.exit(0);
}

checkDefaults().catch(err => {
  console.error(err);
  process.exit(1);
});
