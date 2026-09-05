import pool from '../db.js';

export async function setupProjectBankHistoriesTable() {
  console.log('[MIGRATION] Verificando tabla public.project_bank_histories...');

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS public.project_bank_histories (
      project_bank_history_id SERIAL PRIMARY KEY,
      project_bank_id INTEGER NOT NULL REFERENCES public.project_bank(project_bank_id) ON DELETE RESTRICT,
      user_id VARCHAR(50) NOT NULL REFERENCES public.users(user_id),
      action VARCHAR(50) NOT NULL,
      previous_status VARCHAR(50),
      new_status VARCHAR(50),
      changes JSONB,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_pb_histories_project_id 
      ON public.project_bank_histories(project_bank_id);

    CREATE INDEX IF NOT EXISTS idx_pb_histories_user_id 
      ON public.project_bank_histories(user_id);
  `;

  await pool.query(createTableSql);
  console.log('[MIGRATION] Tabla public.project_bank_histories lista con ON DELETE RESTRICT y changes JSONB.');
}
