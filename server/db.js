import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '123456',
  database: process.env.PGDATABASE || 'BaseDatosGrado',
  port: parseInt(process.env.PGPORT || '5432', 10),
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err);
});

export default pool;
