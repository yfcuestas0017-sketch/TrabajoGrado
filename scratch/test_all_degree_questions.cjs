const { pool } = require('../server/db');

function normalizeChatbookText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isDegreeOptionQuery(norm) {
  // Checks if the question is related to degree options
  if (/\b(opcion de grado|opciones de grado|opcion grado|opciones grado)\b/.test(norm)) return true;
  if (/\b(modalidad de grado|modalidades de grado|modalidad grado|modalidades grado)\b/.test(norm)) return true;
  if (/\b(coterminalidad|coterminal|co-terminal)\b/.test(norm)) return true;
  if (/\b(articulo cientifico|articulo de grado)\b/.test(norm)) return true;
  if (/\b(monografia|monografias)\b/.test(norm)) return true;
  if (/\b(proyecto de grado|proyectos de grado|trabajo de grado|trabajos de grado)\b/.test(norm)) return true;

  // Question about options with related action words
  if (/\b(opcion|opciones|modalidad|modalidades)\b/.test(norm) &&
      /\b(grado|elegir|eligieron|escogieron|escogio|eligio|escoger|hay|existen|tiene|tienen|tuvieron|tuvo|cada|todas|mas|mayor|menor|distrib|distribuyen|porcent|porcentaje|lista|cuales|que|cuantas|cuantos)\b/.test(norm)) {
    return true;
  }

  // "cuantos se fueron por", "cuantos escogieron", "cuantos eligieron", "cuantos hicieron"
  if (/(cuantos|cuantas|quienes|quien).*(fueron por|escogieron|eligieron|hicieron|tomaron|optaron|realizaron).*(coterminal|articulo|proyecto)/.test(norm)) {
    return true;
  }

  // specific question like "cuantos fueron por articulo"
  if (/(cuantos|cuantas).*(por articulo|por proyecto|por coterminal)/.test(norm)) {
    return true;
  }

  if (/porcentaje.*(coterminal|articulo|proyecto|opcion)/.test(norm)) {
    return true;
  }

  if (/diferencia entre.*(coterminal|proyecto|articulo)/.test(norm)) {
    return true;
  }

  return false;
}

async function handleDegreeOptionsChatbook({ norm, rawText, currentUser, programId, programName, programProjectScope, isStudent }) {
  // 1. Get degree options catalog
  const degOptsRes = await pool.query('SELECT degree_option_id, name, description FROM public.degree_options ORDER BY degree_option_id');
  const catalogOptions = degOptsRes.rows;

  // 2. Query projects in user's program scope
  const projectsRes = await pool.query(`
    SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
           p.degree_option_id, dopt.name as degree_option_name,
           s.name as status_name, rl.name as line_name, rsl.name as subline_name,
           EXTRACT(YEAR FROM p.created_at)::int as created_year,
           COALESCE((
             SELECT json_agg(json_build_object('name', u.full_name, 'role', COALESCE(up.project_role, 'autor'), 'email', u.email))
             FROM public.user_projects up JOIN public.users u ON u.user_id = up.user_id
             WHERE up.project_id = p.project_id AND (up.project_role = 'autor' OR up.project_role = 'coautor' OR up.project_role IS NULL)
           ), '[]'::json) as authors
    FROM public.projects p
    LEFT JOIN public.degree_options dopt ON dopt.degree_option_id = p.degree_option_id
    LEFT JOIN public.statuses s ON s.status_id = p.status_id
    LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
    LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
    WHERE 1=1 ${programProjectScope}
    ORDER BY p.created_at DESC
  `);
  const allProjects = projectsRes.rows;
  const totalProjectsCount = allProjects.length;

  // Count distinct students in scope
  const allStudentNames = new Set();
  allProjects.forEach(p => {
    (p.authors || []).forEach(a => {
      if (a.name) allStudentNames.add(a.name.trim());
    });
  });
  const totalStudentsCount = allStudentNames.size;

  // Calculate distribution per option
  const optionStats = catalogOptions.map(opt => {
    const optProjects = allProjects.filter(p => p.degree_option_id === opt.degree_option_id);
    const studentNames = new Set();
    optProjects.forEach(p => {
      (p.authors || []).forEach(a => {
        if (a.name) studentNames.add(a.name.trim());
      });
    });
    const projPercent = totalProjectsCount > 0 ? ((optProjects.length / totalProjectsCount) * 100).toFixed(1) : '0.0';
    const studPercent = totalStudentsCount > 0 ? ((studentNames.size / totalStudentsCount) * 100).toFixed(1) : '0.0';
    return {
      id: opt.degree_option_id,
      name: opt.name,
      description: opt.description,
      projects: optProjects,
      projectCount: optProjects.length,
      projectPercent: parseFloat(projPercent),
      students: Array.from(studentNames),
      studentCount: studentNames.size,
      studentPercent: parseFloat(studPercent),
    };
  });

  // Intent classification
  const asksDefinitionOrDiff = /que es coterminal|que es articulo|que es proyecto de grado|que significa coterminal|definicion|diferencia entre|en que consiste/.test(norm);
  const asksCoterminal = /coterminal/.test(norm);
  const asksArticulo = /articulo/.test(norm);
  const asksProyectoDeGrado = /proyecto de grado|proyectos de grado/.test(norm) || (/proyecto/.test(norm) && /(cuantos|quienes|fueron por|hicieron|escogieron|optaron|porcentaje)/.test(norm) && !asksCoterminal && !asksArticulo);
  const asksMonografia = /monografia/.test(norm);
  const asksWhichIsMostUsed = /cual.*(mas|mayor|lidera)|opcion mas|mas utilizada|mas elegida|mas escogida|tuvo mas proyectos|mas proyectos|mas escogieron/.test(norm);
  const asksYear = norm.match(/\b(202[0-9])\b/)?.[1] || null;

  // -------------------------------------------------------------
  // CASE A: DIFERENCIAS / DEFINICIONES ENTRE OPCIONES
  // -------------------------------------------------------------
  if (asksDefinitionOrDiff) {
    const lines = [
      `INFORMACIÓN Y DEFINICIÓN DE OPCIONES DE GRADO EN ${programName.toUpperCase()}:`,
      '',
    ];

    if (asksCoterminal && (asksProyectoDeGrado || /proyecto/.test(norm))) {
      lines.push('📌 DIFERENCIA ENTRE PROYECTO DE GRADO Y COTERMINALIDAD:');
      lines.push('');
      lines.push('1. Coterminalidad:');
      lines.push('   • Concepto: Permite cursar y aprobar asignaturas del primer semestre de un posgrado institucional (especialización o maestría) de la Universidad CESMAG como opción de grado en el último nivel de pregrado.');
      lines.push(`   • En ${programName}: Registra ${optionStats.find(o => o.id === 1)?.projectCount || 0} proyecto(s) (${optionStats.find(o => o.id === 1)?.projectPercent || 0}%) y ${optionStats.find(o => o.id === 1)?.studentCount || 0} estudiante(s).`);
      lines.push('');
      lines.push('2. Proyecto de Grado:');
      lines.push('   • Concepto: Desarrollo y sustentación formal de un trabajo de investigación aplicada, desarrollo de software o solución tecnológica estructurado en las tres fases académicas (Investigación I, II y III).');
      lines.push(`   • En ${programName}: Registra ${optionStats.find(o => o.id === 3)?.projectCount || 0} proyecto(s) (${optionStats.find(o => o.id === 3)?.projectPercent || 0}%) y ${optionStats.find(o => o.id === 3)?.studentCount || 0} estudiante(s).`);
      lines.push('');
      lines.push('Diferencia clave: Coterminalidad vincula créditos de posgrado, mientras que Proyecto de Grado es el desarrollo completo de un producto investigativo/tecnológico tradicional.');
    } else {
      catalogOptions.forEach(opt => {
        const stat = optionStats.find(o => o.id === opt.degree_option_id);
        lines.push(`• ${opt.name}:`);
        lines.push(`  - Definición: ${opt.description}`);
        lines.push(`  - Estadísticas actuales en ${programName}: ${stat.projectCount} proyecto(s) (${stat.projectPercent}%) | ${stat.studentCount} estudiante(s) (${stat.studentPercent}%)`);
        lines.push('');
      });
    }

    const stats = optionStats.map(o => ({
      label: o.name,
      value: o.projectCount,
      sublabel: `${o.projectPercent}% de proyectos · ${o.studentCount} estudiante(s)`,
    }));

    return { message: lines.join('\n').trim(), stats, projects: allProjects };
  }

  // -------------------------------------------------------------
  // CASE B: MONOGRAFÍA (Aclaración)
  // -------------------------------------------------------------
  if (asksMonografia) {
    const lines = [
      `CONSULTA SOBRE MONOGRAFÍA EN ${programName.toUpperCase()}:`,
      '',
      'En la información oficial del sistema y la Universidad CESMAG, la monografía no está tipificada como opción de grado independiente.',
      'Las 3 opciones de grado vigentes y registradas son:',
      '1. Coterminalidad',
      '2. Artículo (Artículo Científico)',
      '3. Proyecto de Grado (Desarrollo y propuesta investigativa/tecnológica)',
      '',
      `Si tu interés es un trabajo escrito o documental, este se gestiona bajo la opción de "Proyecto de Grado" o "Artículo".`,
    ];
    return {
      message: lines.join('\n'),
      stats: optionStats.map(o => ({ label: o.name, value: o.projectCount, sublabel: `${o.studentCount} estudiante(s)` })),
      projects: [],
    };
  }

  // -------------------------------------------------------------
  // CASE C: CONSULTA ESPECÍFICA POR AÑO / HISTÓRICO
  // -------------------------------------------------------------
  if (asksYear) {
    const targetYear = parseInt(asksYear, 10);
    const yearProjects = allProjects.filter(p => p.created_year === targetYear);

    if (yearProjects.length === 0) {
      return {
        message: `No encuentro ese dato en la información disponible en este Chatbook para el año ${targetYear}. Los proyectos registrados en el sistema para ${programName} corresponden al año 2026.`,
        stats: [],
        projects: [],
      };
    }

    // Breakdown for that year
    const lines = [
      `PROYECTOS Y OPCIONES DE GRADO EN EL AÑO ${targetYear} — ${programName.toUpperCase()}:`,
      '',
      `Total de proyectos registrados en ${targetYear}: ${yearProjects.length}`,
      '',
      'Distribución por opción de grado:',
    ];

    const yearStats = catalogOptions.map(opt => {
      const projs = yearProjects.filter(p => p.degree_option_id === opt.degree_option_id);
      const pct = ((projs.length / yearProjects.length) * 100).toFixed(1);
      lines.push(`• ${opt.name}: ${projs.length} proyecto(s) (${pct}%)`);
      projs.forEach(p => lines.push(`   - ${p.code || 'Sin código'}: ${p.title}`));
      return { label: opt.name, value: projs.length, sublabel: `${pct}% en ${targetYear}` };
    });

    return {
      message: lines.join('\n').trim(),
      stats: yearStats,
      projects: yearProjects,
    };
  }

  // -------------------------------------------------------------
  // CASE D: COTERMINALIDAD (Específico: proyectos, estudiantes o porcentaje)
  // -------------------------------------------------------------
  if (asksCoterminal && !asksWhichIsMostUsed) {
    const cotStat = optionStats.find(o => o.id === 1);
    const lines = [
      `INFORMACIÓN DE LA OPCIÓN: COTERMINALIDAD — ${programName.toUpperCase()}:`,
      '',
      `• Descripción: ${cotStat.description}.`,
      `• Proyectos registrados: ${cotStat.projectCount} de ${totalProjectsCount} (${cotStat.projectPercent}% del total de proyectos).`,
      `• Estudiantes participantes: ${cotStat.studentCount} de ${totalStudentsCount} (${cotStat.studentPercent}% del total de estudiantes).`,
      '',
    ];

    if (cotStat.projectCount > 0) {
      lines.push('Proyectos asociados a Coterminalidad:');
      cotStat.projects.forEach(p => {
        const auths = (p.authors || []).map(a => a.name).join(', ') || 'Sin registrar';
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Estado: ${p.status_name || 'En proceso'} · Integrantes: ${auths}`);
      });
    } else {
      lines.push('Actualmente no hay proyectos registrados bajo esta opción en el programa.');
    }

    return {
      message: lines.join('\n').trim(),
      stats: [
        { label: 'Coterminalidad - Proyectos', value: cotStat.projectCount, sublabel: `${cotStat.projectPercent}% del total` },
        { label: 'Coterminalidad - Estudiantes', value: cotStat.studentCount, sublabel: `${cotStat.studentPercent}% del total` },
      ],
      projects: cotStat.projects,
    };
  }

  // -------------------------------------------------------------
  // CASE E: ARTÍCULO (Específico: proyectos, estudiantes o porcentaje)
  // -------------------------------------------------------------
  if (asksArticulo && !asksWhichIsMostUsed) {
    const artStat = optionStats.find(o => o.id === 2);
    const lines = [
      `INFORMACIÓN DE LA OPCIÓN: ARTÍCULO CIENTÍFICO — ${programName.toUpperCase()}:`,
      '',
      `• Descripción: ${artStat.description}.`,
      `• Proyectos registrados: ${artStat.projectCount} de ${totalProjectsCount} (${artStat.projectPercent}% del total).`,
      `• Estudiantes participantes: ${artStat.studentCount} de ${totalStudentsCount} (${artStat.studentPercent}% del total).`,
      '',
    ];

    if (artStat.projectCount > 0) {
      lines.push('Proyectos asociados a Artículo:');
      artStat.projects.forEach(p => {
        const auths = (p.authors || []).map(a => a.name).join(', ') || 'Sin registrar';
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Estado: ${p.status_name || 'En proceso'} · Integrantes: ${auths}`);
      });
    } else {
      lines.push('Actualmente no se registran proyectos bajo la opción de Artículo en la base de datos de este programa.');
    }

    return {
      message: lines.join('\n').trim(),
      stats: [
        { label: 'Artículo - Proyectos', value: artStat.projectCount, sublabel: `${artStat.projectPercent}% del total` },
        { label: 'Artículo - Estudiantes', value: artStat.studentCount, sublabel: `${artStat.studentPercent}% del total` },
      ],
      projects: artStat.projects,
    };
  }

  // -------------------------------------------------------------
  // CASE F: PROYECTO DE GRADO (Específico: proyectos, estudiantes o porcentaje)
  // -------------------------------------------------------------
  if (asksProyectoDeGrado && !asksWhichIsMostUsed) {
    const pgStat = optionStats.find(o => o.id === 3);
    const lines = [
      `INFORMACIÓN DE LA OPCIÓN: PROYECTO DE GRADO — ${programName.toUpperCase()}:`,
      '',
      `• Descripción: ${pgStat.description}.`,
      `• Proyectos registrados: ${pgStat.projectCount} de ${totalProjectsCount} (${pgStat.projectPercent}% del total de proyectos).`,
      `• Estudiantes participantes: ${pgStat.studentCount} de ${totalStudentsCount} (${pgStat.studentPercent}% del total de estudiantes).`,
      '',
    ];

    if (pgStat.projectCount > 0) {
      lines.push('Proyectos asociados a Proyecto de Grado:');
      pgStat.projects.forEach(p => {
        const auths = (p.authors || []).map(a => a.name).join(', ') || 'Sin registrar';
        lines.push(`- ${p.code || 'Sin código'} — ${p.title}`);
        lines.push(`  Estado: ${p.status_name || 'En proceso'} · Integrantes: ${auths}`);
      });
    } else {
      lines.push('Actualmente no hay proyectos registrados bajo esta opción en el programa.');
    }

    return {
      message: lines.join('\n').trim(),
      stats: [
        { label: 'Proyecto de Grado - Proyectos', value: pgStat.projectCount, sublabel: `${pgStat.projectPercent}% del total` },
        { label: 'Proyecto de Grado - Estudiantes', value: pgStat.studentCount, sublabel: `${pgStat.studentPercent}% del total` },
      ],
      projects: pgStat.projects,
    };
  }

  // -------------------------------------------------------------
  // CASE G: OPCIÓN MÁS UTILIZADA / MAYOR CANTIDAD
  // -------------------------------------------------------------
  if (asksWhichIsMostUsed) {
    const sorted = [...optionStats].sort((a, b) => b.projectCount - a.projectCount);
    const maxVal = sorted[0].projectCount;
    const leaders = sorted.filter(s => s.projectCount === maxVal && s.projectCount > 0);

    const lines = [
      `OPCIÓN DE GRADO MÁS UTILIZADA EN ${programName.toUpperCase()}:`,
      '',
    ];

    if (leaders.length === 0) {
      lines.push('No hay proyectos con opción de grado registrada actualmente en el sistema.');
    } else if (leaders.length === 1) {
      const leader = leaders[0];
      lines.push(`La opción de grado más utilizada es "${leader.name}" con ${leader.projectCount} proyecto(s) (${leader.projectPercent}% del total) y ${leader.studentCount} estudiante(s) (${leader.studentPercent}%).`);
      const second = sorted[1];
      if (second) {
        lines.push(`Le sigue "${second.name}" con ${second.projectCount} proyecto(s) (${second.projectPercent}%).`);
      }
    } else {
      lines.push(`Existe un empate entre las siguientes opciones de grado, con ${maxVal} proyecto(s) (${leaders[0].projectPercent}%) cada una:`);
      leaders.forEach(l => lines.push(`• ${l.name}: ${l.projectCount} proyecto(s) (${l.projectPercent}%) — ${l.studentCount} estudiante(s) (${l.studentPercent}%)`));
      const others = sorted.filter(s => s.projectCount < maxVal);
      if (others.length > 0) {
        lines.push('');
        lines.push('Otras opciones:');
        others.forEach(o => lines.push(`• ${o.name}: ${o.projectCount} proyecto(s) (${o.projectPercent}%)`));
      }
    }

    return {
      message: lines.join('\n').trim(),
      stats: optionStats.map(o => ({
        label: o.name,
        value: o.projectCount,
        sublabel: `${o.projectPercent}% de proyectos · ${o.studentCount} estudiante(s)`,
      })),
      projects: allProjects,
    };
  }

  // -------------------------------------------------------------
  // CASE H: COMPARACIÓN / DISTRIBUCIÓN / TOTALES / GENERAL
  // -------------------------------------------------------------
  const lines = [
    `DISTRIBUCIÓN Y ESTADÍSTICAS DE OPCIONES DE GRADO EN ${programName.toUpperCase()}:`,
    '',
    `• Total de opciones de grado disponibles: ${catalogOptions.length} modalidades.`,
    `• Total de proyectos registrados: ${totalProjectsCount} proyecto(s).`,
    `• Total de estudiantes participantes: ${totalStudentsCount} estudiante(s).`,
    '',
    'TABLA COMPARATIVA DE OPCIONES DE GRADO:',
    '| Opción de Grado | Proyectos | % Proyectos | Estudiantes | % Estudiantes |',
    '|---|---|---|---|---|',
  ];

  optionStats.forEach(o => {
    lines.push(`| ${o.name} | ${o.projectCount} | ${o.projectPercent}% | ${o.studentCount} | ${o.studentPercent}% |`);
  });

  lines.push('');
  lines.push('DETALLE POR MODALIDAD:');
  optionStats.forEach(o => {
    lines.push(`• ${o.name}:`);
    lines.push(`  ${o.description}`);
    lines.push(`  Participación: ${o.projectCount} proyecto(s) (${o.projectPercent}%) y ${o.studentCount} estudiante(s) (${o.studentPercent}%).`);
    if (o.projects.length > 0) {
      o.projects.forEach(p => lines.push(`   - ${p.code || 'Sin código'}: ${p.title}`));
    }
  });

  const stats = optionStats.map(o => ({
    label: o.name,
    value: o.projectCount,
    sublabel: `${o.projectPercent}% de proyectos (${o.studentCount} estudiantes)`,
  }));

  return {
    message: lines.join('\n').trim(),
    stats,
    projects: allProjects,
  };
}

async function runTests() {
  const questions = [
    '¿Cuántas opciones de grado hay?',
    '¿Qué opciones de grado existen?',
    '¿Cuántos proyectos se fueron por proyecto de grado?',
    '¿Cuántos se fueron por proyecto?',
    '¿Cuántos estudiantes escogieron coterminalidad?',
    '¿Cuántos proyectos se realizaron mediante coterminalidad?',
    '¿Cuántos fueron por artículo?',
    '¿Cuál es la opción de grado más utilizada?',
    '¿Cuál opción tuvo más proyectos?',
    '¿Cuál fue la opción que más escogieron?',
    '¿Cuántos proyectos de grado hubo en 2024?',
    '¿Cuántos proyectos de grado hubo en 2026?',
    '¿Qué porcentaje corresponde a coterminalidad?',
    '¿Cuál es la diferencia entre proyecto de grado y coterminalidad?',
    '¿Cómo se distribuyen las opciones de grado?',
    '¿Cuántos estudiantes eligieron cada opción?',
    '¿Hay opción de monografía?',
  ];

  let passed = 0;
  for (const q of questions) {
    const norm = normalizeChatbookText(q);
    const isDeg = isDegreeOptionQuery(norm);
    if (!isDeg) {
      console.error(`FAILED DETECTING: "${q}"`);
    } else {
      passed++;
      const res = await handleDegreeOptionsChatbook({
        norm,
        rawText: q,
        currentUser: { user_id: 'est001', role_name: 'Estudiante' },
        programId: 1,
        programName: 'Ingeniería de Sistemas',
        programProjectScope: `AND (EXISTS (SELECT 1 FROM public.user_projects up_pr JOIN public.users u_pr ON u_pr.user_id = up_pr.user_id WHERE up_pr.project_id = p.project_id AND u_pr.program_id = 1 AND (up_pr.project_role = 'autor' OR up_pr.project_role = 'coautor' OR up_pr.project_role IS NULL)))`,
        isStudent: true,
      });
      console.log(`PASS: "${q}" -> Message length: ${res.message.length}, Stats: ${res.stats?.length}`);
    }
  }
  console.log(`\nPassed ${passed} of ${questions.length} questions!`);
  pool.end();
}

runTests();
