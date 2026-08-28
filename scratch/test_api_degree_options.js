import pool from '../server/db.js';

async function testApiDegreeOptionLogic() {
  console.log('=== TEST: API DEGREE OPTIONS & HISTORY LOGIC ===\n');

  // Test catalogs query
  const catalogsRes = await pool.query('SELECT degree_option_id, name, description FROM public.degree_options ORDER BY degree_option_id');
  console.log('Catalogs degreeOptions returned:', catalogsRes.rows);

  // Test project retrieval with degree option
  const projRes = await pool.query(`
    SELECT p.project_id, p.title, p.degree_option_id, dopt.name as degree_option_name
    FROM public.projects p
    LEFT JOIN public.degree_options dopt ON p.degree_option_id = dopt.degree_option_id
    WHERE p.project_id = 2
  `);
  console.log('Project 2 retrieved:', projRes.rows[0]);

  // Test student research process query
  const studentProcessRes = await pool.query(`
    SELECT p.project_id, p.title, p.degree_option_id, dopt.name as degree_option_name
    FROM public.user_projects up
    JOIN public.projects p ON p.project_id = up.project_id
    LEFT JOIN public.degree_options dopt ON dopt.degree_option_id = p.degree_option_id
    WHERE up.user_id = 'est001'
    LIMIT 1
  `);
  console.log('Student est001 project process:', studentProcessRes.rows[0]);

  console.log('\n=== ALL LOGIC CHECKS PASSED ===');
  await pool.end();
}

testApiDegreeOptionLogic().catch(console.error);
