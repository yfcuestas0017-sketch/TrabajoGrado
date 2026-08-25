import pool from '../server/db.js';

async function listPrograms() {
  const progs = await pool.query('SELECT program_id, name FROM public.programs');
  console.log('ALL PROGRAMS:', progs.rows);
  process.exit(0);
}

listPrograms();
