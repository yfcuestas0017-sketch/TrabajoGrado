import pool from '../server/db.js';

async function migrateHistoriesTable() {
  console.log('🚀 Agregando columna user_id a la tabla public.histories en BaseDatosGrado...');
  
  await pool.query(`
    ALTER TABLE public.histories 
    ADD COLUMN IF NOT EXISTS user_id varchar(255);
  `);
  
  console.log('✅ Columna user_id agregada / verificada con éxito.');
  process.exit(0);
}

migrateHistoriesTable().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
