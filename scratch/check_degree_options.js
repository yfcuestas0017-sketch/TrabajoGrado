import pool from '../server/db.js';

async function check() {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables:', tables.rows.map(t => t.table_name));

  const projCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects'");
  console.log('Projects columns:', projCols.rows.map(c => `${c.column_name} (${c.data_type})`));

  const degOptionsExists = tables.rows.some(t => t.table_name === 'degree_options');
  if (degOptionsExists) {
    const degCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'degree_options'");
    console.log('degree_options columns:', degCols.rows.map(c => `${c.column_name} (${c.data_type})`));
    const degRows = await pool.query('SELECT * FROM degree_options');
    console.log('degree_options rows:', degRows.rows);
  } else {
    console.log('degree_options table does NOT exist!');
  }

  await pool.end();
}

check().catch(console.error);
