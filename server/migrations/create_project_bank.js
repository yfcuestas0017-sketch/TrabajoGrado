import pool from '../db.js';

export async function setupProjectBankTable() {
  console.log('[MIGRATION] Verificando tabla public.project_bank...');
  
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS public.project_bank (
      project_bank_id SERIAL PRIMARY KEY,
      title VARCHAR(300) NOT NULL,
      description TEXT NOT NULL,
      general_objective TEXT,
      specific_objectives TEXT,
      research_line_id INTEGER REFERENCES public.research_lines(research_line_id),
      research_subline_id INTEGER REFERENCES public.research_sublines(research_subline_id),
      program_id INTEGER REFERENCES public.programs(program_id),
      keywords VARCHAR(300),
      observations TEXT,
      proposer_id VARCHAR(50) NOT NULL REFERENCES public.users(user_id),
      proposer_role VARCHAR(50) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'Disponible',
      assigned_student_id VARCHAR(50) REFERENCES public.users(user_id),
      assigned_at TIMESTAMP WITHOUT TIME ZONE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(createTableSql);
  console.log('[MIGRATION] Tabla public.project_bank lista.');

  // Check if there are existing records
  const countRes = await pool.query('SELECT COUNT(*) FROM public.project_bank');
  const count = parseInt(countRes.rows[0].count, 10);

  if (count === 0) {
    console.log('[MIGRATION] Insertando ideas iniciales para el Banco de Proyectos...');

    const sampleProjects = [
      {
        title: 'Plataforma IoT y Visión Artificial para Monitoreo de Cultivos en Nariño',
        description: 'Diseño e implementación de una solución tecnológica integrada que combine sensores ambientales IoT y modelos de visión por computador para detectar plagas tempranas y optimizar el riego en cultivos agrícolas de minifundios en el departamento de Nariño.',
        general_objective: 'Desarrollar una plataforma inteligente de monitoreo agrícola basada en IoT y visión artificial adaptada a las condiciones agroecológicas de Nariño.',
        specific_objectives: '1. Diseñar la arquitectura de nodos sensores de bajo costo para medición de variables ambientales.\n2. Entrenar un modelo de clasificación convolucional para detección de plagas foliares.\n3. Implementar un dashboard web progresivo accesible para asociaciones campesinas.',
        research_line_id: 2, // Inteligencia Artificial y Ciencia de Datos
        research_subline_id: 6, // Inteligencia Artificial
        program_id: 1, // Ingeniería de Sistemas
        keywords: 'IoT, Visión Artificial, Redes Neuronales, Agricultura de Precisión, Nariño',
        observations: 'Proyecto con posibilidad de articulación con convocatorias del MinCiencias y asociaciones agrícolas de Pasto.',
        proposer_id: 'doc001',
        proposer_role: 'Docente',
        status: 'Disponible',
        assigned_student_id: null,
        assigned_at: null,
        created_at: '2026-02-10 09:30:00',
      },
      {
        title: 'Sistema de Teleasistencia Psicológica y Triaje Emocional con Encriptación Punto a Punto',
        description: 'Aplicación segura orientada a la atención primaria en salud mental juvenil en el contexto universitario, incorporando protocolos psicométricos estandarizados y canales confidenciales de teleorientación orientados a la prevención de crisis emocionales.',
        general_objective: 'Construir un sistema seguro de triaje y orientación psicológica remota para la comunidad universitaria de la Universidad CESMAG.',
        specific_objectives: '1. Definir los flujos psicométricos de tamizaje de ansiedad y depresión validados institucionalmente.\n2. Desarrollar módulos de comunicación encriptada extremo a extremo conforme a la Ley de Protección de Datos.\n3. Evaluar la usabilidad y efectividad con profesionales del Centro de Escucha universitario.',
        research_line_id: 4, // Psicología Clínica y de la Salud
        research_subline_id: null,
        program_id: 2, // Psicología
        keywords: 'Telepsicología, Salud Mental, Triaje Emocional, Privacidad de Datos, Bienestar Universitario',
        observations: 'Requiere trabajo conjunto con el comité de ética y el consultorio psicológico.',
        proposer_id: 'doc003',
        proposer_role: 'Docente',
        status: 'Disponible',
        assigned_student_id: null,
        assigned_at: null,
        created_at: '2026-01-22 14:15:00',
      },
      {
        title: 'Algoritmo de Optimización Heurística para Logística de Distribución Hospitalaria en Pasto',
        description: 'Modelado y desarrollo de un algoritmo de optimización de rutas y gestión de inventario crítico para la red hospitalaria de tercer y cuarto nivel en el municipio de Pasto, minimizando tiempos de entrega de medicamentos vitales.',
        general_objective: 'Optimizar la logística de aprovisionamiento de medicamentos esenciales en centros hospitalarios mediante algoritmos metaheurísticos.',
        specific_objectives: '1. Modelar matemáticamente el problema de enrutamiento vehicular con ventanas de tiempo (VRPTW) del sector salud local.\n2. Implementar un algoritmo genético híbrido para la asignación dinámica de rutas.\n3. Validar con datos históricos de despachos y simular escenarios de contingencia vial.',
        research_line_id: 1, // Desarrollo de Software y Sistemas de Información
        research_subline_id: 1, // Ingeniería de Software
        program_id: 1, // Ingeniería de Sistemas
        keywords: 'Optimización, Metaheurísticas, Algoritmos Genéticos, Logística Hospitalaria, Smart Cities',
        observations: 'Idea orientada a trabajo interdisciplinar con ingeniería industrial y biomédica.',
        proposer_id: 'doc002',
        proposer_role: 'Docente',
        status: 'Disponible',
        assigned_student_id: null,
        assigned_at: null,
        created_at: '2026-03-01 11:00:00',
      },
      {
        title: 'Arquitectura Segura Zero-Trust y Detección de Amenazas en Entornos Académicos',
        description: 'Propuesta e implementación de un modelo de ciberseguridad basado en Zero-Trust y análisis de comportamiento de red mediante aprendizaje no supervisado, protegiendo repositorios institucionales y sistemas de calificaciones.',
        general_objective: 'Implementar un prototipo de arquitectura Zero-Trust con capacidades de detección automática de anomalías en infraestructuras universitarias.',
        specific_objectives: '1. Evaluar vectores de ataque frecuentes en servidores y plataformas LMS.\n2. Desplegar micro-segmentación de red y autenticación multifactor continua.\n3. Integrar un motor de detección de anomalías basado en Isolation Forest.',
        research_line_id: 3, // Seguridad Informática
        research_subline_id: 9, // Ciberseguridad
        program_id: 1, // Ingeniería de Sistemas
        keywords: 'Zero Trust, Ciberseguridad, Machine Learning, Detección de Intrusiones, SIEM',
        observations: 'Propuesto desde la coordinación de tecnología institucional para fortalecimiento de la infraestructura.',
        proposer_id: 'admin001',
        proposer_role: 'Administrador',
        status: 'Disponible',
        assigned_student_id: null,
        assigned_at: null,
        created_at: '2026-02-18 16:40:00',
      },
      {
        title: 'Impacto Psicosocial del Uso Excesivo de Redes Sociales en Estudiantes de Secundaria',
        description: 'Investigación empírica sobre los patrones de uso de plataformas digitales, autoconcepto, ansiedad social y rendimiento académico en adolescentes de grados décimo y once de colegios públicos de Pasto.',
        general_objective: 'Analizar la correlación entre la hiperconectividad digital y los indicadores de bienestar psicosocial en población adolescente.',
        specific_objectives: '1. Aplicar escalas estandarizadas de adicción a redes e imagen corporal.\n2. Conducir grupos focales para explorar vivencias de ciberacoso y comparación social.\n3. Elaborar una guía psicoeducativa de prevención dirigida a docentes y orientadores escolares.',
        research_line_id: 5, // Psicología Social y Comunitaria
        research_subline_id: null,
        program_id: 2, // Psicología
        keywords: 'Psicología Social, Adolescencia, Redes Sociales, Salud Mental, Educación',
        observations: 'Convenio activo con la Secretaría de Educación para acceso a las instituciones educativas.',
        proposer_id: 'doc003',
        proposer_role: 'Docente',
        status: 'Asignado',
        assigned_student_id: 'est005', // Camila Andrea Martínez (Psicología)
        assigned_at: '2026-02-28 10:20:00',
        created_at: '2026-01-15 08:00:00',
      },
      {
        title: 'Microservicios Basados en Blockchain para Trazabilidad de Certificados Académicos',
        description: 'Desarrollo de un sistema de registro distribuido (DLT) y credenciales verificables según el estándar W3C para evitar la falsificación y agilizar la verificación instantánea de actas de grado y diplomas universitarios.',
        general_objective: 'Construir un ecosistema descentralizado de verificación y emisión de certificados académicos mediante contratos inteligentes.',
        specific_objectives: '1. Diseñar el contrato inteligente ERC-721/Soulbound para diplomas inmutables.\n2. Construir una API REST y microservicio de notarización criptográfica.\n3. Desarrollar un portal público de validación por código QR sin intermediarios.',
        research_line_id: 1, // Desarrollo de Software
        research_subline_id: 2, // Desarrollo Web y Móvil
        program_id: 1, // Ingeniería de Sistemas
        keywords: 'Blockchain, Web3, Smart Contracts, Credenciales Verificables, Identidad Digital',
        observations: 'Idea aprobada previamente por el Comité de Investigaciones en estado inactivo por actualización de especificación.',
        proposer_id: 'admin001',
        proposer_role: 'Administrador',
        status: 'Inactivo',
        assigned_student_id: null,
        assigned_at: null,
        created_at: '2025-11-20 15:30:00',
      },
      {
        title: 'Estrategias de Intervención Psicoeducativa para la Deserción Universitaria Temprana',
        description: 'Diseño y validación de un programa de mentoría y fortalecimiento de habilidades blandas dirigido a estudiantes de primeros semestres identificados con alto riesgo de abandono escolar.',
        general_objective: 'Diseñar un modelo psicoeducativo preventivo de la deserción universitaria en la Universidad CESMAG.',
        specific_objectives: '1. Caracterizar factores sociodemográficos y motivacionales asociados a la deserción temprana.\n2. Estructurar talleres de autorregulación emocional y técnicas de estudio.\n3. Medir el impacto en retención y autoeficacia percibida.',
        research_line_id: 6, // Psicología Educativa
        research_subline_id: null,
        program_id: 2, // Psicología
        keywords: 'Deserción Estudiantil, Retención Académica, Autoeficacia, Orientación Vocacional, Pedagogía',
        observations: 'Propuesta liderada desde la decanatura de ciencias sociales.',
        proposer_id: 'admin002',
        proposer_role: 'Administrador',
        status: 'Disponible',
        assigned_student_id: null,
        assigned_at: null,
        created_at: '2026-02-05 10:00:00',
      }
    ];

    for (const p of sampleProjects) {
      await pool.query(
        `INSERT INTO public.project_bank (
          title, description, general_objective, specific_objectives,
          research_line_id, research_subline_id, program_id, keywords,
          observations, proposer_id, proposer_role, status,
          assigned_student_id, assigned_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)`,
        [
          p.title, p.description, p.general_objective, p.specific_objectives,
          p.research_line_id, p.research_subline_id, p.program_id, p.keywords,
          p.observations, p.proposer_id, p.proposer_role, p.status,
          p.assigned_student_id, p.assigned_at, p.created_at
        ]
      );
    }
    console.log(`[MIGRATION] ${sampleProjects.length} ideas insertadas con éxito.`);
  } else {
    console.log(`[MIGRATION] La tabla ya contiene ${count} registros.`);
  }
}
