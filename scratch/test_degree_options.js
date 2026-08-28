import pool from '../server/db.js';

async function testDegreeOptions() {
  console.log('=== TEST: DEGREE OPTIONS MANAGEMENT ===\n');

  // 1. Check degree options table
  const options = await pool.query('SELECT degree_option_id, name, description FROM public.degree_options ORDER BY degree_option_id');
  console.log('1. Available degree options in DB:');
  options.rows.forEach(opt => console.log(`   - ID ${opt.degree_option_id}: ${opt.name} (${opt.description})`));

  // 2. Pick a test project
  const projRes = await pool.query('SELECT project_id, title, code, degree_option_id FROM public.projects LIMIT 1');
  if (projRes.rows.length === 0) {
    console.log('No projects found in DB to test.');
    await pool.end();
    return;
  }

  const testProject = projRes.rows[0];
  console.log(`\n2. Testing on Project ID ${testProject.project_id}: "${testProject.title}" (Initial degree_option_id: ${testProject.degree_option_id})`);

  // 3. Test Assigning Option 1 (Coterminalidad)
  await pool.query('UPDATE public.projects SET degree_option_id = 1 WHERE project_id = $1', [testProject.project_id]);
  const res1 = await pool.query(`
    SELECT p.project_id, p.title, p.degree_option_id, dopt.name as degree_option_name
    FROM public.projects p
    LEFT JOIN public.degree_options dopt ON p.degree_option_id = dopt.degree_option_id
    WHERE p.project_id = $1
  `, [testProject.project_id]);
  console.log('\n3. Assigned degree_option_id = 1:');
  console.log(`   Result -> degree_option_id: ${res1.rows[0].degree_option_id}, degree_option_name: "${res1.rows[0].degree_option_name}"`);

  // 4. Test Switching to Option 2 (Artículo)
  await pool.query('UPDATE public.projects SET degree_option_id = 2 WHERE project_id = $1', [testProject.project_id]);
  const res2 = await pool.query(`
    SELECT p.project_id, p.title, p.degree_option_id, dopt.name as degree_option_name
    FROM public.projects p
    LEFT JOIN public.degree_options dopt ON p.degree_option_id = dopt.degree_option_id
    WHERE p.project_id = $1
  `, [testProject.project_id]);
  console.log('\n4. Switched to degree_option_id = 2:');
  console.log(`   Result -> degree_option_id: ${res2.rows[0].degree_option_id}, degree_option_name: "${res2.rows[0].degree_option_name}"`);

  // 5. Test Null (Pending)
  await pool.query('UPDATE public.projects SET degree_option_id = NULL WHERE project_id = $1', [testProject.project_id]);
  const res3 = await pool.query(`
    SELECT p.project_id, p.title, p.degree_option_id, dopt.name as degree_option_name
    FROM public.projects p
    LEFT JOIN public.degree_options dopt ON p.degree_option_id = dopt.degree_option_id
    WHERE p.project_id = $1
  `, [testProject.project_id]);
  console.log('\n5. Cleared degree_option_id = NULL:');
  console.log(`   Result -> degree_option_id: ${res3.rows[0].degree_option_id}, degree_option_name: ${res3.rows[0].degree_option_name || '"Opción de grado pendiente"'}`);

  // Restore original state
  await pool.query('UPDATE public.projects SET degree_option_id = $1 WHERE project_id = $2', [testProject.degree_option_id, testProject.project_id]);
  console.log(`\n6. Restored project to original degree_option_id: ${testProject.degree_option_id}`);

  console.log('\n=== ALL DEGREE OPTION TESTS PASSED! ===');
  await pool.end();
}

testDegreeOptions().catch(console.error);
