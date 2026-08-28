import pool from '../server/db.js';

async function checkCatalogsEndpointResponse() {
  console.log('=== CHECKING WHAT /api/catalogs WOULD RETURN ===\n');

  const [statuses, modalities, degreeOptions] = await Promise.all([
    pool.query('SELECT status_id, name FROM public.statuses ORDER BY name'),
    pool.query('SELECT modality_id, name FROM public.modalities ORDER BY name'),
    pool.query('SELECT degree_option_id, name, description FROM public.degree_options ORDER BY degree_option_id'),
  ]);

  console.log('statuses:', statuses.rows.length, 'rows');
  console.log('modalities:', modalities.rows.length, 'rows');
  console.log('degreeOptions:', degreeOptions.rows.length, 'rows:', JSON.stringify(degreeOptions.rows));

  await pool.end();
}

checkCatalogsEndpointResponse().catch(console.error);
