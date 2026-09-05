import pool from '../server/db.js';
import {
  classifyChatbookQuery,
  handleRegulationChatbookQuery,
  handleMixedChatbookQuery,
  handleSecurityResponse,
} from '../server/chatbook/chatbook_orchestrator.js';
import { normalizeText } from '../server/chatbook/regulation/regulation_search.js';
import { regulationService } from '../server/chatbook/regulation/regulation_service.js';

async function testExactUserQueries() {
  console.log('================================================================');
  console.log('VERIFICACIÓN EXACTA DE CONSULTAS DEL USUARIO');
  console.log('================================================================\n');

  const queries = [
    '¿Qué dice el reglamento sobre la sustentación?',
    '¿Qué es la coterminalidad?',
    '¿Cómo se conforma el jurado?',
    '¿Qué opciones de grado existen según el reglamento?'
  ];

  for (const q of queries) {
    const norm = normalizeText(q);
    const category = classifyChatbookQuery(norm, q);

    console.log(`================================================================`);
    console.log(`PREGUNTA: "${q}"`);
    console.log(`TEXTO NORMALIZADO: "${norm}"`);
    console.log(`CLASIFICACIÓN OBTENIDA: ${category}`);

    if (category === 'REGULATION') {
      const regResult = await handleRegulationChatbookQuery({ norm, rawText: q });
      console.log(`\nRESPUESTA GENERADA:\n`);
      console.log(regResult.message);
      console.log(`\nTIENE REFERENCIA NORMATIVA: ${/acuerdo 105/i.test(regResult.message) ? 'SÍ' : 'NO'}`);
    } else {
      console.log(`⚠️ ERROR: No fue clasificada como REGULATION.`);
    }
    console.log(`\n`);
  }

  await pool.end();
}

testExactUserQueries().catch(console.error);
