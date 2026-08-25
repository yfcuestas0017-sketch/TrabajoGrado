import pool from '../server/db.js';

async function checkHistoryRows() {
  const res = await pool.query(`
    SELECT h.history_id, ph.project_id, h.description, h.modified_field, h.old_value, h.new_value, h.change_type, h.changed_at, h.user_id
    FROM public.project_histories ph
    JOIN public.histories h ON ph.history_id = h.history_id
    ORDER BY h.changed_at DESC
    LIMIT 20;
  `);
  console.log('--- ULTIMOS 20 REGISTROS DE HISTORIAL ---');
  console.table(res.rows);
  process.exit(0);
}

checkHistoryRows().catch(e => {
  console.error(e);
  process.exit(1);
});
