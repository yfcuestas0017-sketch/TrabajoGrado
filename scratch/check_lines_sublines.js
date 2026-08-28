import pool from '../server/db.js';

async function check() {
  const progs = await pool.query('SELECT * FROM public.programs');
  console.log('Programs:', progs.rows);

  const lines = await pool.query('SELECT * FROM public.research_lines');
  console.log('Lines count:', lines.rows.length);
  console.log('Lines:', lines.rows);

  const sublines = await pool.query('SELECT * FROM public.research_sublines');
  console.log('Sublines count:', sublines.rows.length);
  console.log('Sublines:', sublines.rows);

  await pool.end();
}
check().catch(console.error);
