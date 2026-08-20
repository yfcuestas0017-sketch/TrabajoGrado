import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  const files = [
    '20260819_fix_user_projects_id_default.sql',
    '20260819_semester_dates.sql',
    '20260819_research_process_records.sql'
  ];

  console.log('🔄 Ejecutando migraciones pendientes en BaseDatosGrado...');

  const client = await pool.connect();
  try {
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`\n▶️ Aplicando migración: ${file}`);
        const sql = fs.readFileSync(filePath, 'utf-8');
        await client.query(sql);
        console.log(`✅ ${file} aplicada con éxito.`);
      } else {
        console.warn(`⚠️ Archivo de migración no encontrado: ${filePath}`);
      }
    }
    console.log('\n🎉 ¡Todas las migraciones se aplicaron correctamente!');
  } catch (err) {
    console.error('❌ Error aplicando migraciones:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigrations();
