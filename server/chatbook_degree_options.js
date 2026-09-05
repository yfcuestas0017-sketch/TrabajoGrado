/**
 * Chatbook: Módulo especializado en consultas sobre Opciones de Grado
 * Responde preguntas generales, específicas, estadísticas, comparativas e históricas
 * basadas estrictamente en los datos de la base de datos institucional de la Universidad CESMAG.
 */

export function isDegreeOptionQuery(norm) {
  // Coincidencias directas con terminología de grado
  if (/\b(opcion de grado|opciones de grado|opcion grado|opciones grado)\b/.test(norm)) return true;
  if (/\b(modalidad de grado|modalidades de grado|modalidad grado|modalidades grado)\b/.test(norm)) return true;
  if (/\b(coterminalidad|coterminal|co-terminal)\b/.test(norm)) return true;
  if (/\b(articulo cientifico|articulo de grado)\b/.test(norm)) return true;
  if (/\b(monografia|monografias)\b/.test(norm)) return true;
  if (/\b(proyecto de grado|proyectos de grado|trabajo de grado|trabajos de grado)\b/.test(norm)) return true;

  // Preguntas sobre opciones asociadas a acciones o selección
  if (/\b(opcion|opciones|modalidad|modalidades)\b/.test(norm) &&
      /\b(grado|elegir|eligieron|escogieron|escogio|eligio|escoger|hay|existen|tiene|tienen|tuvieron|tuvo|cada|todas|mas|mayor|menor|distrib|distribuyen|porcent|porcentaje|lista|cuales|que|cuantas|cuantos)\b/.test(norm)) {
    return true;
  }

  // "cuantos se fueron por", "cuantos escogieron", "cuantos eligieron", "cuantos hicieron"
  if (/(cuantos|cuantas|quienes|quien).*(fueron por|escogieron|eligieron|hicieron|tomaron|optaron|realizaron).*(coterminal|articulo|proyecto)/.test(norm)) {
    return true;
  }

  // Preguntas sintéticas directas
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

export async function handleDegreeOptionsChatbook({
  pool,
  norm,
  rawText,
  currentUser,
  programId,
  programName,
  programProjectScope,
  isStudent,
}) {
  // 1. Obtener catálogo oficial de opciones de grado
  const degOptsRes = await pool.query(
    'SELECT degree_option_id, name, description FROM public.degree_options ORDER BY degree_option_id'
  );
  const catalogOptions = degOptsRes.rows;

  // 2. Obtener proyectos dentro del alcance del programa del usuario
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

  // 3. Estudiantes únicos autores/coautores en el programa
  const allStudentNames = new Set();
  allProjects.forEach(p => {
    (p.authors || []).forEach(a => {
      if (a.name) allStudentNames.add(a.name.trim());
    });
  });
  const totalStudentsCount = allStudentNames.size;

  // 4. Calcular métricas precisas por opción de grado
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

  // Clasificación de intención de la pregunta
  const asksDefinitionOrDiff = /que es coterminal|que es articulo|que es proyecto de grado|que significa coterminal|definicion|diferencia entre|en que consiste/.test(norm);
  const asksCoterminal = /coterminal/.test(norm);
  const asksArticulo = /articulo/.test(norm);
  const asksProyectoDeGrado = /proyecto de grado|proyectos de grado/.test(norm) || (/proyecto/.test(norm) && /(cuantos|quienes|fueron por|hicieron|escogieron|optaron|porcentaje)/.test(norm) && !asksCoterminal && !asksArticulo);
  const asksMonografia = /monografia/.test(norm);
  const asksWhichIsMostUsed = /cual.*(mas|mayor|lidera)|opcion mas|mas utilizada|mas elegida|mas escogida|tuvo mas proyectos|mas proyectos|mas escogieron/.test(norm);
  const asksYear = norm.match(/\b(202[0-9])\b/)?.[1] || null;

  // ─────────────────────────────────────────────────────────────
  // 1. DEFINICIONES Y DIFERENCIAS ENTRE OPCIONES
  // ─────────────────────────────────────────────────────────────
  if (asksDefinitionOrDiff) {
    const lines = [
      `INFORMACIÓN Y DEFINICIÓN DE OPCIONES DE GRADO EN ${programName.toUpperCase()}:`,
      '',
    ];

    if (asksCoterminal && (asksProyectoDeGrado || /proyecto/.test(norm))) {
      const cot = optionStats.find(o => o.id === 1);
      const pg = optionStats.find(o => o.id === 3);
      lines.push('📌 DIFERENCIA ENTRE PROYECTO DE GRADO Y COTERMINALIDAD:');
      lines.push('');
      lines.push('1. Coterminalidad:');
      lines.push('   • Concepto: Permite cursar y aprobar asignaturas del primer semestre de un posgrado institucional (especialización o maestría) de la Universidad CESMAG como opción de grado en el último nivel de pregrado.');
      lines.push(`   • Datos en ${programName}: ${cot?.projectCount || 0} proyecto(s) (${cot?.projectPercent || 0}% del total) y ${cot?.studentCount || 0} estudiante(s) vinculados.`);
      lines.push('');
      lines.push('2. Proyecto de Grado:');
      lines.push('   • Concepto: Desarrollo y sustentación formal de un trabajo de investigación aplicada, desarrollo de software o solución tecnológica estructurado en las tres fases académicas (Investigación I, II y III).');
      lines.push(`   • Datos en ${programName}: ${pg?.projectCount || 0} proyecto(s) (${pg?.projectPercent || 0}% del total) y ${pg?.studentCount || 0} estudiante(s) vinculados.`);
      lines.push('');
      lines.push('Diferencia fundamental: Coterminalidad homologa créditos académicos de nivel posgrado, mientras que Proyecto de Grado requiere la entrega y sustentación de un producto y documento de investigación tradicional.');
    } else {
      catalogOptions.forEach(opt => {
        const stat = optionStats.find(o => o.id === opt.degree_option_id);
        lines.push(`• ${opt.name}:`);
        lines.push(`  - Definición: ${opt.description}`);
        lines.push(`  - Registro actual en ${programName}: ${stat.projectCount} proyecto(s) (${stat.projectPercent}%) | ${stat.studentCount} estudiante(s) (${stat.studentPercent}%)`);
        lines.push('');
      });
    }

    const stats = optionStats.map(o => ({
      label: o.name,
      value: o.projectCount,
      sublabel: `${o.projectPercent}% de proyectos · ${o.studentCount} estudiante(s)`,
    }));

    return { message: lines.join('\n').trim(), stats, projects: [] };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. MONOGRAFÍA (ACLARACIÓN SEGÚN LINEAMIENTOS CESMAG)
  // ─────────────────────────────────────────────────────────────
  if (asksMonografia) {
    const lines = [
      `CONSULTA SOBRE MONOGRAFÍA EN ${programName.toUpperCase()}:`,
      '',
      'En la información oficial del sistema de la Universidad CESMAG, la monografía no figura como opción de grado independiente.',
      'Las 3 opciones de grado vigentes y registradas son:',
      '1. Coterminalidad (créditos de posgrado)',
      '2. Artículo (Artículo Científico)',
      '3. Proyecto de Grado (Desarrollo y propuesta investigativa/tecnológica)',
      '',
      'Cualquier trabajo de investigación teórica o aplicada se canaliza mediante las opciones de "Proyecto de Grado" o "Artículo".',
    ];
    return {
      message: lines.join('\n'),
      stats: optionStats.map(o => ({ label: o.name, value: o.projectCount, sublabel: `${o.studentCount} estudiante(s)` })),
      projects: [],
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CONSULTA HISTÓRICA / POR AÑO O PERIODO
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // 4. COTERMINALIDAD (CONSULTA ESPECÍFICA)
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // 5. ARTÍCULO CIENTÍFICO (CONSULTA ESPECÍFICA)
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // 6. PROYECTO DE GRADO (CONSULTA ESPECÍFICA)
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // 7. COMPARACIÓN / OPCIÓN MÁS UTILIZADA O LÍDER
  // ─────────────────────────────────────────────────────────────
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
        lines.push('Otras opciones con menor registro:');
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
      projects: [],
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 8. CONSULTA GENERAL / DISTRIBUCIÓN COMPLETA / TABLA COMPARATIVA
  // ─────────────────────────────────────────────────────────────
  const lines = [
    `DISTRIBUCIÓN Y ESTADÍSTICAS DE OPCIONES DE GRADO EN ${programName.toUpperCase()}:`,
    '',
    `• Total de opciones de grado disponibles: ${catalogOptions.length} modalidades institucionales.`,
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
    projects: [],
  };
}
