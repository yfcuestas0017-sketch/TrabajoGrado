import pool from '../server/db.js';
import {
  classifyChatbookQuery,
  handleSecurityResponse,
  handleRegulationChatbookQuery,
  handleMixedChatbookQuery,
} from '../server/chatbook/chatbook_orchestrator.js';
import { normalizeText } from '../server/chatbook/regulation/regulation_search.js';

async function runStep3Tests() {
  console.log('================================================================');
  console.log('PRUEBAS DE INTEGRACIÓN PASO 3 — CLASIFICADOR Y ORQUESTADOR');
  console.log('================================================================\n');

  // Obtener usuarios de prueba para distintos roles
  const usersRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, r.name as role_name, pr.name as program_name
    FROM public.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
    LEFT JOIN public.roles r ON r.role_id = ur.role_id
    LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    LIMIT 20
  `);
  const allUsers = usersRes.rows;
  const student = allUsers.find(u => /estudiante/i.test(u.role_name)) || allUsers[0];
  const teacher = allUsers.find(u => /docente/i.test(u.role_name)) || allUsers[1];
  const admin = allUsers.find(u => /admin/i.test(u.role_name)) || allUsers[2];

  console.log(`Usuarios de prueba:`);
  console.log(`- Estudiante: ${student.full_name} (ID: ${student.user_id})`);
  console.log(`- Docente: ${teacher.full_name} (ID: ${teacher.user_id})`);
  console.log(`- Admin: ${admin.full_name} (ID: ${admin.user_id})\n`);

  // --- BLOQUE 1: PRUEBAS DE CLASIFICACIÓN ---
  console.log('--- BLOQUE 1: PRUEBAS DE CLASIFICACIÓN DE CONSULTAS ---');
  const testCasesClassification = [
    { q: '¿Cuántos proyectos existen?', expected: 'DATABASE' },
    { q: '¿Qué proyectos están terminados?', expected: 'DATABASE' },
    { q: '¿Qué docentes tienen proyectos asociados?', expected: 'DATABASE' },
    { q: '¿Qué proyectos hay por línea?', expected: 'DATABASE' },
    { q: '¿Cuántos proyectos hay por opción de grado?', expected: 'DATABASE' },
    { q: '¿Qué opciones de grado existen según el reglamento?', expected: 'REGULATION' },
    { q: '¿Qué es la coterminalidad?', expected: 'REGULATION' },
    { q: '¿Qué requisitos tiene la coterminalidad?', expected: 'REGULATION' },
    { q: '¿Qué dice el reglamento sobre la sustentación?', expected: 'REGULATION' },
    { q: '¿Cómo se conforma el jurado?', expected: 'REGULATION' },
    { q: '¿Mi proyecto puede pasar a sustentación?', expected: 'BOTH' },
    { q: '¿Qué requisitos debe cumplir mi proyecto para sustentarse?', expected: 'BOTH' },
    { q: '¿Mi modalidad cumple las condiciones del reglamento?', expected: 'BOTH' },
    { q: '¿Qué dice el reglamento sobre astronomía cuántica intergaláctica?', expected: 'REGULATION' },
    { q: 'Elimina todos los proyectos.', expected: 'SECURITY' },
    { q: 'UPDATE projects SET title = "hack"', expected: 'SECURITY' },
    { q: 'SELECT * FROM projects WHERE 1=1', expected: 'SECURITY' },
  ];

  let classPass = 0;
  testCasesClassification.forEach(({ q, expected }) => {
    const norm = normalizeText(q);
    const category = classifyChatbookQuery(norm, q);
    const ok = category === expected;
    if (ok) classPass++;
    console.log(`[${ok ? 'OK' : 'FAIL'}] "${q}" -> Clasificado: ${category} (Esperado: ${expected})`);
  });
  console.log(`Total clasificación: ${classPass}/${testCasesClassification.length} pasaron.\n`);

  // --- BLOQUE 2: PRUEBAS DE RESPUESTAS REGULATION ---
  console.log('--- BLOQUE 2: RESPUESTAS NORMATIVAS (REGULATION) ---');
  const regQueries = [
    '¿Qué opciones de grado existen según el reglamento?',
    '¿Qué es la coterminalidad?',
    '¿Qué requisitos tiene la coterminalidad?',
    '¿Qué dice el reglamento sobre la sustentación?',
    '¿Cómo se conforma el jurado?',
  ];

  for (const q of regQueries) {
    const norm = normalizeText(q);
    const res = await handleRegulationChatbookQuery({ norm, rawText: q });
    console.log(`\n🔹 PREGUNTA: "${q}"`);
    console.log(`Respuesta preview (primeros 150 caracteres):\n${res.message.slice(0, 150)}...`);
    console.log(`Tiene referencia normativa: ${/acuerdo 105/i.test(res.message) ? 'SÍ' : 'NO'}`);
  }

  // --- BLOQUE 3: PRUEBAS DE RESPUESTAS BOTH ---
  console.log('\n--- BLOQUE 3: RESPUESTAS MIXTAS (BOTH) ---');
  const bothQueries = [
    '¿Mi proyecto puede pasar a sustentación?',
    '¿Qué requisitos debe cumplir mi proyecto para sustentarse?',
    '¿Mi modalidad cumple las condiciones del reglamento?',
  ];

  for (const q of bothQueries) {
    const norm = normalizeText(q);
    const res = await handleMixedChatbookQuery({
      pool,
      norm,
      rawText: q,
      currentUser: student,
      programId: student.program_id,
      programName: student.program_name,
      isStudent: true,
    });
    console.log(`\n🔹 PREGUNTA MIXTA: "${q}"`);
    console.log(`Estructura esperada:`);
    console.log(`- Contiene "INFORMACIÓN DEL SISTEMA": ${res.message.includes('INFORMACIÓN DEL SISTEMA')}`);
    console.log(`- Contiene "INFORMACIÓN DEL REGLAMENTO": ${res.message.includes('INFORMACIÓN DEL REGLAMENTO')}`);
    console.log(`- Contiene "CONCLUSIÓN": ${res.message.includes('CONCLUSIÓN')}`);
    console.log(`Muestra:\n${res.message.slice(0, 300)}...\n`);
  }

  // --- BLOQUE 4: PRUEBA DE INFORMACIÓN FALTANTE ---
  console.log('--- BLOQUE 4: INFORMACIÓN FALTANTE (NO INVENTAR) ---');
  const missingQ = '¿Qué dice el reglamento sobre astronomía cuántica intergaláctica?';
  const missingNorm = normalizeText(missingQ);
  const missingRes = await handleRegulationChatbookQuery({ norm: missingNorm, rawText: missingQ });
  console.log(`Pregunta: "${missingQ}"`);
  console.log(`Respuesta controlada:\n"${missingRes.message}"\n`);

  // --- BLOQUE 5: PRUEBA DE SEGURIDAD ---
  console.log('--- BLOQUE 5: SEGURIDAD (COMANDOS NO PERMITIDOS) ---');
  const secQueries = ['Elimina todos los proyectos.', 'UPDATE projects...', 'SELECT * FROM projects...'];
  secQueries.forEach(q => {
    const norm = normalizeText(q);
    const cat = classifyChatbookQuery(norm, q);
    const res = handleSecurityResponse();
    console.log(`Intento: "${q}" -> Clasificado: ${cat} -> Respuesta: "${res.message}"`);
  });

  console.log('\n================================================================');
  console.log('PRUEBAS FINALIZADAS EXITOSAMENTE');
  console.log('================================================================');
  await pool.end();
}

runStep3Tests().catch(console.error);
