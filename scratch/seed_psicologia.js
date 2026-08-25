import pool from '../server/db.js';

async function seedPsicologiaData() {
  console.log('Seeding distinct Psicología lines, sublines and projects...');

  // Clean up any previously created duplicate Psicología lines
  await pool.query(`DELETE FROM public.research_lines WHERE name ILIKE '%Psicología%' OR name ILIKE '%Neuropsicología%'`);

  // 1. Insert distinct research lines for Psicología
  const line1Res = await pool.query(`
    INSERT INTO public.research_lines (name, description)
    VALUES ('Psicología Clínica y de la Salud', 'Evaluación, diagnóstico, intervención y promoción de la salud mental y el bienestar')
    RETURNING research_line_id
  `);
  const line1 = line1Res.rows[0].research_line_id;

  const line2Res = await pool.query(`
    INSERT INTO public.research_lines (name, description)
    VALUES ('Psicología Social y Comunitaria', 'Estudio de dinámicas psicosociales, procesos comunitarios, convivencia y familia')
    RETURNING research_line_id
  `);
  const line2 = line2Res.rows[0].research_line_id;

  const line3Res = await pool.query(`
    INSERT INTO public.research_lines (name, description)
    VALUES ('Psicología Educativa y del Desarrollo', 'Procesos de enseñanza-aprendizaje, orientación vocacional y desarrollo socioemocional')
    RETURNING research_line_id
  `);
  const line3 = line3Res.rows[0].research_line_id;

  const line4Res = await pool.query(`
    INSERT INTO public.research_lines (name, description)
    VALUES ('Neuropsicología y Procesos Cognitivos', 'Evaluación de funciones ejecutivas, memoria, atención y neurodesarrollo')
    RETURNING research_line_id
  `);
  const line4 = line4Res.rows[0].research_line_id;

  console.log('Lines created:', { line1, line2, line3, line4 });

  // 2. Insert sublines
  const sub1 = (await pool.query(`INSERT INTO public.research_sublines (name, description, research_line_id) VALUES ('Salud Mental y Bienestar Emocional', 'Prevención del estrés, ansiedad y promoción de la calidad de vida', $1) RETURNING research_subline_id`, [line1])).rows[0].research_subline_id;
  const sub2 = (await pool.query(`INSERT INTO public.research_sublines (name, description, research_line_id) VALUES ('Evaluación e Intervención Psicológica', 'Técnicas de evaluación y modelos terapéuticos aplicados', $1) RETURNING research_subline_id`, [line1])).rows[0].research_subline_id;
  
  const sub3 = (await pool.query(`INSERT INTO public.research_sublines (name, description, research_line_id) VALUES ('Procesos Comunitarios y Convivencia', 'Tejido social, participación y resolución pacífica de conflictos', $1) RETURNING research_subline_id`, [line2])).rows[0].research_subline_id;
  const sub4 = (await pool.query(`INSERT INTO public.research_sublines (name, description, research_line_id) VALUES ('Dinámicas Psicosociales y Familiares', 'Vínculos afectivos, pautas de crianza y funcionamiento familiar', $1) RETURNING research_subline_id`, [line2])).rows[0].research_subline_id;

  const sub5 = (await pool.query(`INSERT INTO public.research_sublines (name, description, research_line_id) VALUES ('Procesos de Aprendizaje y Rendimiento', 'Factores cognitivos y motivacionales en el ámbito escolar y universitario', $1) RETURNING research_subline_id`, [line3])).rows[0].research_subline_id;
  const sub6 = (await pool.query(`INSERT INTO public.research_sublines (name, description, research_line_id) VALUES ('Orientación Vocacional y Desarrollo', 'Construcción de proyecto de vida y toma de decisiones vocacionales', $1) RETURNING research_subline_id`, [line3])).rows[0].research_subline_id;

  const sub7 = (await pool.query(`INSERT INTO public.research_sublines (name, description, research_line_id) VALUES ('Funciones Ejecutivas y Memoria', 'Procesos atencionales y memoria operativa en diferentes etapas del ciclo vital', $1) RETURNING research_subline_id`, [line4])).rows[0].research_subline_id;

  console.log('Sublines created.');

  // 3. Get users for Psicología
  const users = (await pool.query(`SELECT user_id, email, full_name FROM public.users WHERE program_id = 6`)).rows;
  const magda = users.find(u => u.email === 'mcagreda.4846@unicesmag.edu.co');
  const maria = users.find(u => u.email === 'prueba2@unicesmag.edu.co');
  const gabriel = users.find(u => u.email === 'garevalo.3642@unicesmag.edu.co');
  const francisco = users.find(u => u.email === 'francisco@unicesmag.edu.co');
  const mariaPaes = users.find(u => u.email === 'prueba122@unicesmag.edu.co');

  // 4. Remove previous user_projects links for Psicología users on Sistemas projects
  for (const u of users) {
    await pool.query(`DELETE FROM public.user_projects WHERE user_id = $1`, [u.user_id]);
  }
  console.log('Cleaned old user_projects for Psicología users.');

  // Delete previous PSI- projects if any
  await pool.query(`DELETE FROM public.projects WHERE code LIKE 'PSI-%'`);

  // 5. Create 7 brand new distinct Psicología projects
  const statuses = (await pool.query(`SELECT status_id, name FROM public.statuses`)).rows;
  const enCursoId = statuses.find(s => s.name.toLowerCase().includes('curso'))?.status_id || 1;
  const finalizadoId = statuses.find(s => s.name.toLowerCase().includes('finalizad'))?.status_id || 2;
  const propuestaId = statuses.find(s => s.name.toLowerCase().includes('propuest'))?.status_id || 3;

  const modalities = (await pool.query(`SELECT modality_id, name FROM public.modalities`)).rows;
  const investigacionModId = modalities[0]?.modality_id || 1;
  const pasantiaModId = modalities[1]?.modality_id || 2;
  const monografiaModId = modalities[2]?.modality_id || 3;

  const psiProjects = [
    {
      code: 'PSI-001',
      title: 'Evaluación del Bienestar Psicológico y Estrategias de Afrontamiento al Estrés en Jóvenes Universitarios',
      research_line_id: line1,
      research_subline_id: sub1,
      status_id: enCursoId,
      modality_id: investigacionModId,
      author: magda,
      advisor: francisco,
    },
    {
      code: 'PSI-002',
      title: 'Factores Psicosociales Asociados a la Convivencia Escolar y Clima Emocional en Educación Media',
      research_line_id: line2,
      research_subline_id: sub3,
      status_id: enCursoId,
      modality_id: investigacionModId,
      author: maria,
      advisor: mariaPaes,
    },
    {
      code: 'PSI-003',
      title: 'Influencia de las Funciones Ejecutivas y la Memoria Operativa en el Rendimiento Académico',
      research_line_id: line4,
      research_subline_id: sub7,
      status_id: enCursoId,
      modality_id: monografiaModId,
      author: gabriel,
      advisor: francisco,
    },
    {
      code: 'PSI-004',
      title: 'Intervención Psicológica Basada en Regulación Emocional y Mindfulness para la Reducción de la Ansiedad',
      research_line_id: line1,
      research_subline_id: sub2,
      status_id: finalizadoId,
      modality_id: investigacionModId,
      author: magda,
      advisor: mariaPaes,
    },
    {
      code: 'PSI-005',
      title: 'Dinámicas de Apego Familiar y su Incidencia en la Autoestima de Adolescentes Escolarizados',
      research_line_id: line2,
      research_subline_id: sub4,
      status_id: finalizadoId,
      modality_id: pasantiaModId,
      author: maria,
      advisor: francisco,
    },
    {
      code: 'PSI-006',
      title: 'Estrategias de Orientación Vocacional y Toma de Decisiones en Estudiantes de Último Año de Bachillerato',
      research_line_id: line3,
      research_subline_id: sub6,
      status_id: propuestaId,
      modality_id: monografiaModId,
      author: gabriel,
      advisor: mariaPaes,
    },
    {
      code: 'PSI-007',
      title: 'Impacto del Acompañamiento Psicoeducativo en la Adaptación a la Vida Universitaria y Permanencia Estudiantil',
      research_line_id: line3,
      research_subline_id: sub5,
      status_id: propuestaId,
      modality_id: investigacionModId,
      author: magda,
      advisor: francisco,
    },
  ];

  for (const p of psiProjects) {
    const prjRes = await pool.query(`
      INSERT INTO public.projects (title, code, created_at, finished_at, research_line_id, research_subline_id, status_id, modality_id)
      VALUES ($1, $2, NOW() - INTERVAL '60 days', NOW() + INTERVAL '120 days', $3, $4, $5, $6)
      RETURNING project_id
    `, [p.title, p.code, p.research_line_id, p.research_subline_id, p.status_id, p.modality_id]);

    const newProjectId = prjRes.rows[0].project_id;

    // Assign author
    if (p.author) {
      await pool.query(`
        INSERT INTO public.user_projects (project_id, user_id, project_role, started_at)
        VALUES ($1, $2, 'autor', NOW())
      `, [newProjectId, p.author.user_id]);
    }

    // Assign advisor
    if (p.advisor) {
      await pool.query(`
        INSERT INTO public.user_projects (project_id, user_id, project_role, started_at)
        VALUES ($1, $2, 'asesor', NOW())
      `, [newProjectId, p.advisor.user_id]);
    }
  }

  console.log('Successfully created 7 distinct Psicología projects with author & advisor assignments!');
  process.exit(0);
}

seedPsicologiaData().catch(err => {
  console.error('Error seeding data:', err);
  process.exit(1);
});
