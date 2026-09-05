/**
 * ORQUESTADOR Y CLASIFICADOR DE CONSULTAS DEL CHATBOOK
 * UNIVERSIDAD CESMAG
 *
 * Determina el origen de la información para cada consulta:
 * 1. DATABASE: Información dinámica registrada en PostgreSQL/Supabase (proyectos, docentes, estados, fechas, estadísticas).
 * 2. REGULATION: Contenido normativo oficial del Reglamento de Trabajo de Grado y Tesis (Acuerdo 105 de 2023 / 064 de 2024).
 * 3. BOTH: Preguntas mixtas que contrastan el estado real del proyecto en BD con las condiciones normativas del reglamento.
 * 4. SECURITY: Intercepción de intentos de inyección SQL o comandos de modificación no permitidos.
 */

import { regulationService } from './regulation/regulation_service.js';
import { normalizeText } from './regulation/regulation_search.js';

/**
 * Clasifica la intención y fuente requerida para una consulta
 *
 * @param {string} norm - Texto de la consulta normalizado (sin acentos, minúsculas)
 * @param {string} rawText - Texto original de la consulta
 * @returns {string} 'SECURITY' | 'REGULATION' | 'BOTH' | 'DATABASE'
 */
export function classifyChatbookQuery(norm, rawText = '') {
  const rawLower = String(rawText || '').toLowerCase();

  // 1. SEGURIDAD: Detección de comandos SQL o intentos de modificación
  const isSecurityThreat = (
    /\b(drop\s+table|drop\s+database|truncate|delete\s+from|insert\s+into|update\s+\w+|alter\s+table|create\s+table|grant\s+|revoke\s+)\b/i.test(rawLower) ||
    /\b(select\s+(\*|[\w\s,]+)\s+from|union\s+select|exec\s*\(|execute\s*\()\b/i.test(rawLower) ||
    /\b(elimina\s+todos|borra\s+los\s+proyectos|eliminar\s+proyectos|borrar\s+base\s+de\s+datos)\b/i.test(norm) ||
    /\b(drop\s+table|truncate|delete\s+from|insert\s+into|update\s+\w+|alter\s+table|select\s+from)\b/i.test(norm)
  );
  if (isSecurityThreat) {
    return 'SECURITY';
  }

  // 2. MIXTAS (BOTH): Preguntas que contrastan el proyecto del usuario con las reglas normativas
  const asksMyProjectStateVsRegulation = (
    /\b(mi proyecto|mis proyectos|mi trabajo|mi modalidad|mi tesis)\b/i.test(norm) &&
    (
      /\b(puede pasar a|puedo pasar a|esta listo para|cumple con|cumple los requisitos|requisitos para pasar|requisitos para sustentar|condiciones para sustentar|puedo sustentar|ya puede sustentar|ya puedo sustentar|que le falta|que requisitos debe cumplir|cumple las condiciones)\b/i.test(norm) ||
      (/\b(sustentar|sustentacion|evaluacion|aprobacion|jurados|grados)\b/i.test(norm) && /\b(puedo|puede|listo|requisito|requisitos|autorizado|autorizacion)\b/i.test(norm))
    )
  );

  if (asksMyProjectStateVsRegulation) {
    return 'BOTH';
  }

  // 3. NORMATIVAS (REGULATION): Preguntas sobre normas, artículos, requisitos generales, distinciones o modalidades teóricas
  const explicitRegulationMention = /\b(reglamento|acuerdo 105|acuerdo 064|normativa|norma|articulo\s+\d+|capitulo\s+[ivxldcm]+|paragrafo)\b/i.test(norm);

  const asksPureNormativeConcept = (
    /\b(que es la coterminalidad|que es coterminalidad|que requisitos tiene la coterminalidad|requisitos de coterminalidad)\b/i.test(norm) ||
    /\b(que es creacion de empresa|requisitos de creacion de empresa|estancia en linea de investigacion|estudio de factibilidad|investigacion creacion)\b/i.test(norm) ||
    /\b(que dice el reglamento|segun el reglamento|establece el reglamento|segun el acuerdo|estipula el acuerdo)\b/i.test(norm) ||
    /\b(como se conforma el jurado|quienes conforman el jurado|funciones del jurado|funciones del asesor|quien puede ser jurado|quien puede ser asesor|designacion de jurados)\b/i.test(norm) ||
    /\b(como se evalua|como es la sustentacion|requisitos de sustentacion|criterios de evaluacion|concepto de jurados|causales de reprobacion)\b/i.test(norm) ||
    /\b(que distinciones existen|criterios para meritorio|criterios para laureado|requisitos para meritorio|requisitos para laureado|distincion cum laude|magna cum laude|summa cum laude)\b/i.test(norm) ||
    /\b(que pasa si hay plagio|sanciones por plagio|faltas disciplinarias|regimen disciplinario|fraude academico)\b/i.test(norm) ||
    /\b(fases del trabajo de grado|etapas del trabajo de grado|requisitos de la idea|requisitos del anteproyecto|extension del anteproyecto|extension del informe final)\b/i.test(norm) ||
    /\b(que modalidades de grado existen segun el reglamento|cuales son las modalidades del reglamento|que opciones de grado hay segun el reglamento|opciones de grado del acuerdo)\b/i.test(norm) ||
    /\b(cambio de asesor|renuncia de asesor|separacion de integrantes|disolucion de grupos)\b/i.test(norm)
  );

  // Consultas sobre temas inexistentes con fórmula normativa ("qué dice el reglamento sobre X")
  const isNormativeExploration = explicitRegulationMention || asksPureNormativeConcept;

  if (isNormativeExploration) {
    return 'REGULATION';
  }

  // 4. DATABASE: Preguntas sobre conteos, estados en BD, docentes asignados, fechas reales, proyectos por línea
  return 'DATABASE';
}

/**
 * Maneja respuestas de seguridad contra instrucciones no permitidas
 */
export function handleSecurityResponse() {
  return {
    message: 'El Chatbook es exclusivamente un módulo de consulta y orientación informativa institucional. No se permiten operaciones de modificación, inserción, eliminación ni ejecución directa de comandos en el sistema.',
    projects: [],
    stats: [],
  };
}

/**
 * Maneja consultas exclusivamente normativas utilizando regulationService
 */
export async function handleRegulationChatbookQuery({ norm, rawText }) {
  const searchRes = await regulationService.search(rawText || norm);

  if (!searchRes.success || searchRes.results.length === 0) {
    return {
      message: `No encuentro esta información en el reglamento institucional disponible (Acuerdo 105 de 2023 de la Universidad CESMAG).`,
      projects: [],
      stats: [],
    };
  }

  // Caso: Se encontró coincidencia de modalidad específica en Artículo 6
  if (searchRes.modalities && searchRes.modalities.length > 0) {
    const lines = [
      'INFORMACIÓN NORMATIVA — MODALIDADES DE TRABAJO DE GRADO:',
      'Fuente: Acuerdo 105 de 2023 del Consejo Académico de la Universidad CESMAG.',
      '',
    ];

    if (searchRes.modalities.length > 3) {
      lines.push('El Artículo 6 del Reglamento de Trabajo de Grado y Tesis establece 18 modalidades oficiales:');
      lines.push('');
      searchRes.modalities.forEach((m, idx) => {
        lines.push(`${idx + 1}. [Literal ${m.literal}] ${m.name}:`);
        lines.push(`   ${m.short_description || m.full_text.slice(0, 180)}`);
        lines.push('');
      });
    } else {
      searchRes.modalities.forEach(m => {
        lines.push(`• ${m.name} (${m.article_reference}):`);
        lines.push(m.full_text);
        lines.push('');
      });
    }

    lines.push('Referencia normativa: Acuerdo 105 de 2023, Capítulo II, Artículo 6.');
    return {
      message: lines.join('\n').trim(),
      projects: [],
      stats: [],
      normativeResults: searchRes.results,
    };
  }

  // Caso: Se encontraron distinciones académicas (Meritorio, Laureado, etc.)
  if (searchRes.distinctions && searchRes.distinctions.length > 0) {
    const lines = [
      'INFORMACIÓN NORMATIVA — DISTINCIONES ACADÉMICAS:',
      'Fuente: Acuerdo 105 de 2023 (Capítulo VI, Artículos 37 y 38), compilado con el Acuerdo 064 de 2024 del Consejo Académico.',
      '',
    ];

    searchRes.distinctions.forEach(d => {
      lines.push(`📌 ${d.name}:`);
      lines.push(`   - Nivel: ${d.academic_level}`);
      lines.push(`   - Otorga: ${d.awarded_by}`);
      lines.push(`   - Exigencia de calificación: ${d.score_requirement}`);
      lines.push(`   - Requisitos: ${d.requirements_summary}`);
      lines.push(`   - Referencia: ${d.normative_reference}`);
      lines.push('');
    });

    return {
      message: lines.join('\n').trim(),
      projects: [],
      stats: [],
      normativeResults: searchRes.results,
    };
  }

  // Caso: Artículos normativos encontrados
  const topResult = searchRes.results[0];
  const lines = [
    `INFORMACIÓN NORMATIVA — ${topResult.chapter_title.toUpperCase()}:`,
    `Fuente: ${topResult.normative_reference} — "${topResult.title}"`,
    '',
    topResult.content,
  ];

  if (topResult.modification) {
    lines.push('');
    lines.push(`📌 NOTA NORMATIVA: ${topResult.modification.modifying_agreement} (${topResult.modification.notes})`);
  }

  return {
    message: lines.join('\n').trim(),
    projects: [],
    stats: [],
    normativeResults: searchRes.results,
  };
}

/**
 * Maneja consultas mixtas (BOTH) que requieren contrastar BD + Reglamento
 */
export async function handleMixedChatbookQuery({
  pool,
  norm,
  rawText,
  currentUser,
  programId,
  programName,
  isStudent
}) {
  // 1. Obtener proyectos del usuario autenticado en el sistema
  let userProjects = [];
  if (isStudent) {
    const userProjRes = await pool.query(`
      SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
             s.name as status_name, m.name as modality_name,
             rl.name as line_name, rsl.name as subline_name,
             up.project_role
      FROM public.user_projects up
      JOIN public.projects p ON p.project_id = up.project_id
      LEFT JOIN public.statuses s ON s.status_id = p.status_id
      LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
      LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
      LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
      WHERE up.user_id = $1
      ORDER BY p.created_at DESC
    `, [currentUser.user_id]);
    userProjects = userProjRes.rows;
  } else {
    // Para docentes o coordinadores, proyectos vinculados
    const projRes = await pool.query(`
      SELECT p.project_id, p.code, p.title, p.created_at, p.finished_at,
             s.name as status_name, m.name as modality_name,
             rl.name as line_name, rsl.name as subline_name
      FROM public.projects p
      LEFT JOIN public.statuses s ON s.status_id = p.status_id
      LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
      LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
      LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
      WHERE 1=1 ${programId ? `AND (rl.program_id = ${programId} OR rl.program_id IS NULL)` : ''}
      ORDER BY p.created_at DESC LIMIT 5
    `);
    userProjects = projRes.rows;
  }

  // 2. Consultar requisitos normativos aplicables en regulationService
  const isSustentacionQuery = /sustenta|sustentacion/.test(norm);
  const isModalityQuery = /modalidad|coterminal|pasantia|articulo/.test(norm);

  let regTopic = 'sustentación';
  let regArticleNum = 24;
  if (isModalityQuery) {
    regTopic = 'modalidades';
    regArticleNum = 6;
  }

  const regArticle = await regulationService.getArticle(regArticleNum);

  // 3. Estructurar la respuesta en el formato requerido (SISTEMA + REGLAMENTO + CONCLUSIÓN)
  const systemLines = ['INFORMACIÓN DEL SISTEMA:'];
  if (userProjects.length === 0) {
    systemLines.push('No encuentro proyectos registrados actualmente en el sistema para tu usuario.');
  } else {
    userProjects.forEach(p => {
      systemLines.push(`• Proyecto: ${p.code || 'Sin código'} — "${p.title}"`);
      systemLines.push(`  - Estado actual registrado: ${p.status_name || 'En desarrollo'}`);
      systemLines.push(`  - Modalidad registrada: ${p.modality_name || 'No especificada'}`);
      systemLines.push(`  - Línea: ${p.line_name || 'Sin línea asignada'}`);
    });
  }

  const regulationLines = ['INFORMACIÓN DEL REGLAMENTO:'];
  if (regArticle) {
    regulationLines.push(`Según el ${regArticle.normative_reference} ("${regArticle.title}"):`);
    if (isSustentacionQuery) {
      regulationLines.push('Para que un trabajo de grado sea presentado a sustentación formal en pregrado se requiere:');
      regulationLines.push('1. Contar con el aval escrito favorable del asesor temático/metodológico.');
      regulationLines.push('2. Haber superado la revisión y concepto favorable de los jurados evaluadores designados.');
      regulationLines.push('3. Haber cursado y aprobado la totalidad de los créditos del plan de estudios y espacios de investigación correspondientes.');
    } else {
      regulationLines.push(regArticle.content.slice(0, 500) + '...');
    }
  } else {
    regulationLines.push('No se encontró información normativa relacionada en el reglamento disponible.');
  }

  const conclusionLines = ['CONCLUSIÓN:'];
  if (userProjects.length === 0) {
    conclusionLines.push('No es posible determinar la viabilidad de avance porque no posees proyectos activos registrados en el sistema.');
  } else {
    const currentStatus = userProjects[0].status_name || '';
    if (/terminado|aprobado|sustentado/i.test(currentStatus)) {
      conclusionLines.push(`Tu proyecto registra estado "${currentStatus}" en el sistema. Si ya cumpliste los requisitos normativos y aprobaciones de jurados, puedes verificar los trámites de grado en secretaría académica.`);
    } else if (/revision|evaluacion/i.test(currentStatus)) {
      conclusionLines.push(`Tu proyecto se encuentra en "${currentStatus}". Deberás esperar el concepto formal de aprobación de los jurados evaluadores antes de programar la sustentación según lo estipulado en el Artículo 24.`);
    } else {
      conclusionLines.push(`Tu proyecto registra estado "${currentStatus}". Para pasar a sustentación formal es indispensable culminar el informe final y obtener el aval formal de tu asesor y los jurados asignados.`);
    }
  }

  const fullResponse = [
    ...systemLines,
    '',
    ...regulationLines,
    '',
    ...conclusionLines
  ].join('\n');

  return {
    message: fullResponse,
    projects: userProjects,
    stats: [],
  };
}
