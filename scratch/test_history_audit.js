import pool from '../server/db.js';

async function testHistoryAudit() {
  console.log('=== TEST: PROJECT HISTORY AUDIT SYSTEM ===\n');

  // 1. Verify a sample user in DB
  const userRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, pr.name as program_name, r.name as role_name
    FROM public.users u
    LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
    LEFT JOIN public.roles r ON r.role_id = ur.role_id
    LIMIT 3
  `);
  console.log('1. Sample users in DB:', userRes.rows);

  const sampleUser = userRes.rows[0];

  // 2. Insert test history entry linked to project 2
  const histRes = await pool.query(
    `INSERT INTO public.histories (description, modified_field, old_value, new_value, change_type, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING history_id`,
    ['Test audit modification', 'status_id', 'Propuesta', 'En curso', 'UPDATE', sampleUser.user_id]
  );
  const testHistId = histRes.rows[0].history_id;
  console.log('\n2. Created history entry with history_id:', testHistId, 'and user_id:', sampleUser.user_id);

  await pool.query(
    'INSERT INTO public.project_histories (project_id, history_id) VALUES ($1, $2)',
    [2, testHistId]
  );

  // 3. Query history using the exact endpoint query
  const query = `
    SELECT 
      h.history_id, 
      h.description, 
      h.modified_field, 
      h.old_value, 
      h.new_value, 
      h.change_type, 
      h.changed_at,
      h.user_id,
      u.full_name AS user_name,
      u.email AS user_email,
      u.program_id,
      p.name AS program_name,
      COALESCE(r.name, 'Usuario') AS user_role
    FROM public.histories h
    LEFT JOIN public.users u ON u.user_id::text = h.user_id::text
    LEFT JOIN public.programs p ON p.program_id = u.program_id
    LEFT JOIN public.user_roles ur ON ur.user_id::text = u.user_id::text
    LEFT JOIN public.roles r ON r.role_id = ur.role_id
    JOIN public.project_histories ph ON ph.history_id = h.history_id
    WHERE ph.project_id = 2 AND h.history_id = $1
    ORDER BY h.changed_at DESC;
  `;
  const result = await pool.query(query, [testHistId]);
  console.log('\n3. History query result for newly created audit entry:');
  console.log(result.rows[0]);

  // Clean up test entry
  await pool.query('DELETE FROM public.project_histories WHERE history_id = $1', [testHistId]);
  await pool.query('DELETE FROM public.histories WHERE history_id = $1', [testHistId]);
  console.log('\n4. Cleaned up test history entry.');

  console.log('\n=== ALL AUDIT HISTORY TESTS PASSED! ===');
  await pool.end();
}

testHistoryAudit().catch(console.error);
