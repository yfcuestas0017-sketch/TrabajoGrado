import pool from '../server/db.js';
import { getUserContext } from '../server/project_bank_helpers.js';

async function run() {
  console.log('--- TEST DE FILTRADO DE HISTORIAL POR ROL ---');

  // Let's find a project that has history entries
  const projRes = await pool.query(`
    SELECT ph.project_id, COUNT(h.history_id) as total_histories
    FROM public.project_histories ph
    JOIN public.histories h ON ph.history_id = h.history_id
    GROUP BY ph.project_id
    ORDER BY total_histories DESC
    LIMIT 1;
  `);

  if (projRes.rows.length === 0) {
    console.log('No hay proyectos con historial para testear.');
    process.exit(0);
  }

  const testProjectId = projRes.rows[0].project_id;
  console.log(`Proyecto seleccionado para test: ${testProjectId} (Total historial en BD: ${projRes.rows[0].total_histories})`);

  // Users to test with
  const adminId = 'admin001';
  const docId = 'doc001';
  const estId = 'est004';

  const testUsers = [
    { id: adminId, expectedRole: 'administrador' },
    { id: docId, expectedRole: 'docente' },
    { id: estId, expectedRole: 'estudiante' },
  ];

  for (const tu of testUsers) {
    const userCtx = await getUserContext(pool, tu.id);
    console.log(`\nUsuario: ${tu.id} | Rol obtenido: ${userCtx?.role_name || 'desconocido'}`);

    let query = `
      SELECT 
        h.history_id, 
        h.description, 
        h.user_id,
        u.full_name AS user_name,
        COALESCE(r.name, 'Usuario') AS user_role
      FROM public.histories h
      LEFT JOIN public.users u ON u.user_id::text = h.user_id::text
      LEFT JOIN public.programs p ON p.program_id = u.program_id
      LEFT JOIN public.user_roles ur ON ur.user_id::text = u.user_id::text
      LEFT JOIN public.roles r ON r.role_id = ur.role_id
      JOIN public.project_histories ph ON ph.history_id = h.history_id
      WHERE ph.project_id = $1
    `;
    const params = [testProjectId];

    if (userCtx && (userCtx.role_name === 'estudiante' || userCtx.role_name === 'docente')) {
      params.push(String(tu.id));
      query += `
        AND (
          h.user_id::text = $${params.length}
          OR LOWER(COALESCE(r.name, '')) IN ('administrador', 'admin')
          OR u.user_id ILIKE 'admin%'
          OR u.email ILIKE '%admin%'
          OR h.user_id IS NULL
        )
      `;
    }

    query += ` ORDER BY h.changed_at DESC;`;

    const res = await pool.query(query, params);
    console.log(`-> Registros visibles: ${res.rows.length}`);
    res.rows.slice(0, 3).forEach(r => {
      console.log(`   [History #${r.history_id}] actor: ${r.user_id} (${r.user_role}) - ${r.description}`);
    });
  }

  // Let's test Banco de Proyectos history as well
  const pbRes = await pool.query(`SELECT project_bank_id FROM public.project_bank LIMIT 1`);
  if (pbRes.rows.length > 0) {
    const pbId = pbRes.rows[0].project_bank_id;
    console.log(`\n--- TEST BANCO DE PROYECTOS HISTORIAL (ID: ${pbId}) ---`);
    for (const tu of testUsers) {
      const userCtx = await getUserContext(pool, tu.id);
      let historyQuery = `
        SELECT 
          pbh.project_bank_history_id,
          pbh.user_id,
          COALESCE(r.name, 'Usuario') AS user_role,
          pbh.action
        FROM public.project_bank_histories pbh
        LEFT JOIN public.users u ON pbh.user_id = u.user_id
        LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
        LEFT JOIN public.roles r ON ur.role_id = r.role_id
        WHERE pbh.project_bank_id = $1
      `;
      const params = [pbId];

      if (userCtx && (userCtx.role_name === 'estudiante' || userCtx.role_name === 'docente')) {
        params.push(String(tu.id));
        historyQuery += `
          AND (
            pbh.user_id::text = $${params.length}
            OR LOWER(COALESCE(r.name, '')) IN ('administrador', 'admin')
            OR u.user_id ILIKE 'admin%'
            OR u.email ILIKE '%admin%'
            OR pbh.user_id IS NULL
          )
        `;
      }
      const res = await pool.query(historyQuery, params);
      console.log(`Usuario: ${tu.id} (${userCtx?.role_name}) -> Registros visibles en Banco: ${res.rows.length}`);
    }
  }

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
