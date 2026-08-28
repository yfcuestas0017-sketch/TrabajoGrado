import pool from '../server/db.js';

async function testLineIsolation() {
  console.log('=== TEST: PROGRAM ISOLATION OF RESEARCH LINES & SUBLINES ===\n');

  // 1. Get users from both programs
  const usersRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, r.name as role_name, p.name as program_name
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    JOIN public.programs p ON p.program_id = u.program_id
  `);

  const vanessa = usersRes.rows.find(u => u.email === 'vanessa.criollo@unicesmag.edu.co'); // Estudiante Sistemas (prog 1)
  const mariana = usersRes.rows.find(u => u.email === 'mariana.diaz@unicesmag.edu.co'); // Estudiante Psicología (prog 2)
  const adminSis = usersRes.rows.find(u => u.email === 'admin@unicesmag.edu.co'); // Admin Sistemas (prog 1)
  const adminPsi = usersRes.rows.find(u => u.email === 'admin.psicologia@unicesmag.edu.co'); // Admin Psicología (prog 2)

  console.log('Test Users:');
  console.log(' - Vanessa (Sistemas):', vanessa ? `${vanessa.full_name} (ID: ${vanessa.user_id}, Program: ${vanessa.program_id})` : 'NOT FOUND');
  console.log(' - Mariana (Psicología):', mariana ? `${mariana.full_name} (ID: ${mariana.user_id}, Program: ${mariana.program_id})` : 'NOT FOUND');
  console.log(' - Admin Sistemas:', adminSis ? `${adminSis.full_name} (ID: ${adminSis.user_id}, Program: ${adminSis.program_id})` : 'NOT FOUND');
  console.log(' - Admin Psicología:', adminPsi ? `${adminPsi.full_name} (ID: ${adminPsi.user_id}, Program: ${adminPsi.program_id})` : 'NOT FOUND');

  // 2. Test direct catalog queries for program 1 (Sistemas) and program 2 (Psicología)
  console.log('\n--- 1. Testing Catalogs Program Isolation ---');

  async function getCatalogsForProgram(targetProgramId) {
    const lineQuery = targetProgramId
      ? { text: 'SELECT research_line_id, name, description, program_id FROM public.research_lines WHERE program_id = $1 ORDER BY name', values: [targetProgramId] }
      : { text: 'SELECT research_line_id, name, description, program_id FROM public.research_lines ORDER BY name' };

    const sublineQuery = targetProgramId
      ? { text: `SELECT rsl.research_subline_id, rsl.name, rsl.description, rsl.research_line_id
                 FROM public.research_sublines rsl
                 JOIN public.research_lines rl ON rl.research_line_id = rsl.research_line_id
                 WHERE rl.program_id = $1
                 ORDER BY rsl.name`, values: [targetProgramId] }
      : { text: 'SELECT research_subline_id, name, description, research_line_id FROM public.research_sublines ORDER BY name' };

    const [lines, sublines] = await Promise.all([
      pool.query(lineQuery),
      pool.query(sublineQuery),
    ]);
    return { lines: lines.rows, sublines: sublines.rows };
  }

  const catSis = await getCatalogsForProgram(1);
  const catPsi = await getCatalogsForProgram(2);

  console.log('\n[Sistemas - Program 1 Lines]:');
  catSis.lines.forEach(l => console.log(` • ${l.name}`));
  console.log(`Sublines count for Sistemas: ${catSis.sublines.length}`);
  const sisHasPsi = catSis.lines.some(l => l.name.toLowerCase().includes('psicolog'));
  console.log('Contains Psicología lines?:', sisHasPsi ? 'FAIL (Leak)' : 'PASSED (0 leaks)');

  console.log('\n[Psicología - Program 2 Lines]:');
  catPsi.lines.forEach(l => console.log(` • ${l.name}`));
  console.log(`Sublines count for Psicología: ${catPsi.sublines.length}`);
  const psiHasSis = catPsi.lines.some(l => l.name.toLowerCase().includes('software') || l.name.toLowerCase().includes('seguridad') || l.name.toLowerCase().includes('datos'));
  console.log('Contains Sistemas lines?:', psiHasSis ? 'FAIL (Leak)' : 'PASSED (0 leaks)');

  // 3. Test Student & Admin lines queries
  console.log('\n--- 2. Testing Chatbook Lines Query Logic ---');

  async function getLinesForStudentOrAdmin(programId, programName) {
    const linesRes = await pool.query(`
      SELECT rl.research_line_id, rl.name, rl.description,
             COALESCE((SELECT json_agg(json_build_object('name', rsl.name, 'description', rsl.description))
                       FROM public.research_sublines rsl 
                       WHERE rsl.research_line_id = rl.research_line_id
                      ), '[]'::json) as sublines
      FROM public.research_lines rl
      WHERE 1=1
        ${programId ? `AND rl.program_id = ${programId}` : ''}
      ORDER BY rl.name
    `);
    const lines = [`LÍNEAS DE INVESTIGACIÓN REGISTRADAS EN ${programName.toUpperCase()} (${linesRes.rows.length}):`, ''];
    linesRes.rows.forEach(l => {
      lines.push(`• ${l.name}: ${l.description || 'Línea de investigación institucional'}`);
      if (l.sublines && l.sublines.length > 0) {
        lines.push(`  Sublíneas: ${l.sublines.map(s => s.name).join(', ')}`);
      }
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  const sisResult = await getLinesForStudentOrAdmin(1, 'Ingeniería de Sistemas');
  console.log('\n--- Output for Sistemas User ---');
  console.log(sisResult);

  const psiResult = await getLinesForStudentOrAdmin(2, 'Psicología');
  console.log('\n--- Output for Psicología User ---');
  console.log(psiResult);

  console.log('\n--- 3. Testing Teacher Sublines Query Logic ---');

  async function getSublinesForTeacher(programId, programName) {
    const sublinesRes = await pool.query(`
      SELECT rl.name as line_name, rsl.name as subline_name
      FROM public.research_sublines rsl
      JOIN public.research_lines rl ON rl.research_line_id = rsl.research_line_id
      WHERE 1=1
        ${programId ? `AND rl.program_id = ${programId}` : ''}
      ORDER BY rl.name, rsl.name
    `);
    const grouped = {};
    sublinesRes.rows.forEach(r => {
      if (!grouped[r.line_name]) grouped[r.line_name] = [];
      grouped[r.line_name].push(r.subline_name);
    });
    const lines = [`SUBLÍNEAS POR LÍNEA DE INVESTIGACIÓN EN ${programName.toUpperCase()}:`, ''];
    Object.entries(grouped).forEach(([lName, sList]) => {
      lines.push(`• ${lName}:`);
      lines.push(`  ${sList.join(', ')}`);
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  const sisSublines = await getSublinesForTeacher(1, 'Ingeniería de Sistemas');
  console.log('\n--- Teacher Sublines for Sistemas ---');
  console.log(sisSublines);

  const psiSublines = await getSublinesForTeacher(2, 'Psicología');
  console.log('\n--- Teacher Sublines for Psicología ---');
  console.log(psiSublines);

  await pool.end();
}

testLineIsolation().catch(console.error);
