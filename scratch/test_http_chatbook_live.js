import express from 'express';
import pool from '../server/db.js';
import {
  classifyChatbookQuery,
  handleSecurityResponse,
  handleRegulationChatbookQuery,
  handleMixedChatbookQuery,
} from '../server/chatbook/chatbook_orchestrator.js';
import { normalizeText } from '../server/chatbook/regulation/regulation_search.js';

const app = express();
app.use(express.json());

app.post('/test/chatbook/query', async (req, res) => {
  const { message } = req.body;
  const rawText = String(message || '');
  const norm = normalizeText(rawText);

  console.log(`\n[ENDPOINT LOG] 📩 Mensaje: "${rawText}"`);
  const queryCategory = classifyChatbookQuery(norm, rawText);
  console.log(`[ENDPOINT LOG] 🎯 Tipo detectado: ${queryCategory}`);

  if (queryCategory === 'SECURITY') {
    console.log(`[ENDPOINT LOG] 🛡️ Rama: SECURITY`);
    return res.json(handleSecurityResponse());
  }

  if (queryCategory === 'BOTH') {
    console.log(`[ENDPOINT LOG] 🔄 Rama: BOTH`);
    const mixed = await handleMixedChatbookQuery({
      pool,
      norm,
      rawText,
      currentUser: { user_id: 'est001', full_name: 'Estudiante Prueba', program_id: 6 },
      programId: 6,
      programName: 'Ingeniería de Sistemas',
      isStudent: true,
    });
    return res.json(mixed);
  }

  if (queryCategory === 'REGULATION') {
    console.log(`[ENDPOINT LOG] 📜 Rama: REGULATION`);
    const reg = await handleRegulationChatbookQuery({ norm, rawText });
    console.log(`[ENDPOINT LOG] 📜 Resultado: ${reg.message.slice(0, 100)}...`);
    return res.json(reg);
  }

  console.log(`[ENDPOINT LOG] 🗄️ Rama: DATABASE`);
  return res.json({ message: 'Rama DATABASE ejecutada.', projects: [] });
});

const server = app.listen(9876, async () => {
  try {
    const testCases = [
      '¿Qué dice el reglamento sobre la sustentación?',
      '¿Qué es la coterminalidad?',
      '¿Cómo se conforma el jurado?',
      '¿Qué opciones de grado existen según el reglamento?'
    ];

    for (const msg of testCases) {
      const resp = await fetch('http://localhost:9876/test/chatbook/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await resp.json();
      console.log(`HTTP Status: ${resp.status} | Respuesta contiene "Acuerdo 105": ${data.message?.includes('Acuerdo 105')}`);
    }
  } finally {
    server.close();
    await pool.end();
  }
});
