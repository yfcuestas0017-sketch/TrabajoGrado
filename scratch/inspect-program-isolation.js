import pool from '../server/db.js';

async function inspectPrograms() {
  console.log('==================================================');
  console.log('AUDITORÍA DE AISLAMIENTO POR PROGRAMA ACADÉMICO');
  console.log('==================================================\n');

  // 1. Programas
  const progs = await pool.query('SELECT program_id, name, faculty_id FROM public.programs ORDER BY program_id');
  console.log('🏛️ PROGRAMAS EN BaseDatosGrado:');
  console.table(progs.rows);

  // 2. Usuarios por programa
  const usersByProg = await pool.query(`
    SELECT u.program_id, COALESCE(p.name, 'Sin programa') as program_name, COUNT(*) as cantidad_usuarios
    FROM public.users u
    LEFT JOIN public.programs p ON u.program_id = p.program_id
    GROUP BY u.program_id, p.name
    ORDER BY u.program_id;
  `);
  console.log('\n👥 USUARIOS POR PROGRAMA:');
  console.table(usersByProg.rows);

  // 3. Proyectos y el programa de sus autores/integrantes
  const projectsProg = await pool.query(`
    SELECT 
      p.project_id, 
      p.title,
      STRING_AGG(DISTINCT u.full_name || ' (' || COALESCE(pr.name, 'Sin prog') || ' - ' || COALESCE(up.project_role, 'autor') || ')', ', ') as integrantes
    FROM public.projects p
    LEFT JOIN public.user_projects up ON p.project_id = up.project_id
    LEFT JOIN public.users u ON up.user_id = u.user_id
    LEFT JOIN public.programs pr ON u.program_id = pr.program_id
    GROUP BY p.project_id, p.title
    ORDER BY p.project_id;
  `);
  console.log('\n📁 PROYECTOS E INTEGRANTES CON SUS PROGRAMAS:');
  console.table(projectsProg.rows.slice(0, 15));

  process.exit(0);
}

inspectPrograms().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
