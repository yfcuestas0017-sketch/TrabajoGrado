import pool from '../server/db.js';

async function fixSeq() {
  const maxRes = await pool.query('SELECT MAX(user_role_id) as max_id FROM public.user_roles');
  const seqRes = await pool.query("SELECT last_value FROM user_roles_user_role_id_seq");
  console.log('MAX(user_role_id):', maxRes.rows[0].max_id);
  console.log('last_value seq:', seqRes.rows[0].last_value);

  // Set sequence to max_id + 1
  const maxId = maxRes.rows[0].max_id || 1;
  await pool.query(`SELECT setval('user_roles_user_role_id_seq', ${maxId})`);
  console.log(`Secuencia sincronizada al valor ${maxId}`);

  // Now insert the missing teachers
  for (const uid of ['doc005', 'doc006', 'doc007', 'doc008', 'doc009', 'doc010']) {
    try {
      const res = await pool.query(`
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES ($1, 2)
        RETURNING *;
      `, [uid]);
      console.log(`✓ Insertado correctamente ${uid}:`, res.rows[0]);
    } catch (e) {
      console.error(`❌ Error insertando ${uid}:`, e.message);
    }
  }

  await pool.end();
}

fixSeq().catch(console.error);
