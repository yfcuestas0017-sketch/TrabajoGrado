import pool from '../server/db.js';

async function inspectHistory() {
  console.log('==================================================');
  console.log('AUDITORÍA DE TABLAS DE HISTORIAL EN BaseDatosGrado');
  console.log('==================================================\n');

  // 1. Columnas de histories
  const hCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'histories' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  console.log('📋 COLUMNAS TABLA public.histories:');
  console.table(hCols.rows);

  // 2. Columnas de project_histories
  const phCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'project_histories' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  console.log('\n📋 COLUMNAS TABLA public.project_histories:');
  console.table(phCols.rows);

  // 3. Registros de ejemplo en histories
  const sampleH = await pool.query(`
    SELECT h.*, ph.project_id
    FROM public.histories h
    LEFT JOIN public.project_histories ph ON h.history_id = ph.history_id
    ORDER BY h.history_id DESC
    LIMIT 10;
  `);
  console.log('\n📝 MUESTRA REGISTROS HISTORIAL:');
  console.table(sampleH.rows);

  process.exit(0);
}

inspectHistory().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
