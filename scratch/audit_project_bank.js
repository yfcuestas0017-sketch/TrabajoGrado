import pool from '../server/db.js';

async function runAudit() {
  console.log('=== AUDITORÍA DEL BANCO DE PROYECTOS ===\n');

  // 1. Columnas
  const cols = await pool.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'project_bank' 
    ORDER BY ordinal_position;
  `);
  console.log('1. COLUMNAS DE public.project_bank:');
  console.table(cols.rows);

  // 2. Claves primarias, foráneas y restricciones
  const constraints = await pool.query(`
    SELECT 
      tc.constraint_name, 
      tc.constraint_type, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name, 
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints tc 
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name 
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu 
      ON ccu.constraint_name = tc.constraint_name 
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'project_bank';
  `);
  console.log('\n2. RESTRICCIONES Y CLAVES (PK / FK):');
  console.table(constraints.rows);

  // 3. Índices
  const indexes = await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'project_bank';
  `);
  console.log('\n3. ÍNDICES:');
  console.table(indexes.rows);

  // 4. Registros actuales
  const records = await pool.query(`
    SELECT 
      project_bank_id, 
      title, 
      program_id, 
      research_line_id, 
      research_subline_id, 
      proposer_id, 
      proposer_role, 
      status, 
      assigned_student_id, 
      assigned_at, 
      created_at 
    FROM public.project_bank 
    ORDER BY project_bank_id;
  `);
  console.log(`\n4. REGISTROS ACTUALES (${records.rows.length}):`);
  console.table(records.rows);

  // 5. Verificar si existen otras tablas o esquemas con nombre similar o copias
  const allTables = await pool.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name ILIKE '%bank%' OR table_name ILIKE '%banco%' OR table_name ILIKE '%idea%'
    ORDER BY table_schema, table_name;
  `);
  console.log('\n5. OTRAS TABLAS CON NOMBRES SIMILARES:');
  console.table(allTables.rows);

  // 6. Verificar historial existente en la base de datos
  const historyTables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND (table_name ILIKE '%histor%' OR table_name ILIKE '%audit%');
  `);
  console.log('\n6. TABLAS DE HISTORIAL/AUDITORÍA EXISTENTES:');
  console.table(historyTables.rows);

  for (const ht of historyTables.rows) {
    const hCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [ht.table_name]);
    console.log(`Columnas de ${ht.table_name}:`, hCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }

  await pool.end();
}

runAudit().catch(err => {
  console.error('Error en auditoría:', err);
  process.exit(1);
});
