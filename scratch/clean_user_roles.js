import pool from '../server/db.js';

async function main() {
  const constraints = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'public.user_roles'::regclass;
  `);
  console.log('Restricciones de user_roles:');
  console.table(constraints.rows);

  // Ver si hay duplicados
  const duplicates = await pool.query(`
    SELECT user_id, role_id, COUNT(*), array_agg(user_role_id) as ids
    FROM public.user_roles
    GROUP BY user_id, role_id
    HAVING COUNT(*) > 1;
  `);
  console.log('Duplicados en user_roles:');
  console.table(duplicates.rows);

  // Eliminar duplicados manteniendo el menor user_role_id
  if (duplicates.rows.length > 0) {
    for (const row of duplicates.rows) {
      const keepId = Math.min(...row.ids);
      const deleteIds = row.ids.filter(id => id !== keepId);
      await pool.query(`DELETE FROM public.user_roles WHERE user_role_id = ANY($1::int[])`, [deleteIds]);
      console.log(`Eliminados IDs duplicados ${deleteIds} para user ${row.user_id}, conservado ${keepId}`);
    }
  }

  // Sincronizar secuencia
  const maxRes = await pool.query('SELECT MAX(user_role_id) as max_id FROM public.user_roles');
  const maxId = maxRes.rows[0].max_id || 1;
  await pool.query(`SELECT setval('user_roles_user_role_id_seq', ${maxId})`);
  console.log(`Secuencia ajustada a ${maxId}`);

  // Agregar constraint UNIQUE (user_id, role_id) si no existe
  const hasUnique = constraints.rows.some(c => c.def.includes('UNIQUE (user_id, role_id)'));
  if (!hasUnique) {
    try {
      await pool.query(`
        ALTER TABLE public.user_roles 
        ADD CONSTRAINT uq_user_roles_user_id_role_id UNIQUE (user_id, role_id);
      `);
      console.log('✓ Restricción UNIQUE (user_id, role_id) agregada.');
    } catch (e) {
      console.log('Nota sobre UNIQUE constraint:', e.message);
    }
  }

  // Verificar todos los docentes de users y asegurar que tengan rol 2
  const missingRoleDocentes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email
    FROM public.users u
    LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id AND ur.role_id = 2
    WHERE (u.user_id ILIKE 'doc%' OR u.email ILIKE '%docente%')
      AND ur.user_role_id IS NULL;
  `);
  console.log('Docentes sin rol 2:', missingRoleDocentes.rows);
  for (const d of missingRoleDocentes.rows) {
    await pool.query(`
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES ($1, 2)
      ON CONFLICT DO NOTHING;
    `, [d.user_id]);
    console.log(`✓ Rol 2 asignado a ${d.user_id} (${d.full_name})`);
  }

  await pool.end();
}

main().catch(console.error);
