import pool from '../server/db.js';

async function fixDocentes() {
  const checkConstraints = await pool.query(`
    SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'user_roles';
  `);
  console.log('CONSTRAINTS in user_roles:');
  console.table(checkConstraints.rows);

  const urCols = await pool.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'user_roles';
  `);
  console.log('COLUMNS in user_roles:');
  console.table(urCols.rows);

  for (const uid of ['doc005', 'doc006', 'doc007', 'doc008', 'doc009', 'doc010']) {
    try {
      const res = await pool.query(`
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES ($1, 2)
        RETURNING *;
      `, [uid]);
      console.log(`✓ Insertado ${uid}:`, res.rows[0]);
    } catch (e) {
      console.error(`❌ Error insertando ${uid}:`, e.message);
    }
  }

  await pool.end();
}

fixDocentes().catch(err => {
  console.error(err);
  process.exit(1);
});
