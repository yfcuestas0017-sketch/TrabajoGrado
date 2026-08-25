import pool from '../server/db.js';

function normalizeChatbookText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function detectOtherProgramQuery(normMessage, userProgramId, allPrograms) {
  if (!userProgramId || !allPrograms || allPrograms.length <= 1) return null;
  const currentProg = allPrograms.find(p => p.program_id === userProgramId);
  const currentProgNorm = currentProg ? normalizeChatbookText(currentProg.name) : '';

  for (const prog of allPrograms) {
    if (prog.program_id === userProgramId) continue;
    const progNorm = normalizeChatbookText(prog.name);
    
    if (progNorm.length >= 4 && normMessage.includes(progNorm)) {
      return prog;
    }

    const words = progNorm.split(/\s+/).filter(w => w.length >= 4 && !['para', 'sobre', 'ciencias', 'facultad'].includes(w));
    for (const word of words) {
      if (currentProgNorm.includes(word)) continue;
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(normMessage)) {
        return prog;
      }
    }
  }
  return null;
}

async function runTests() {
  const allProgs = (await pool.query('SELECT program_id, name FROM public.programs')).rows;
  console.log('Programs:', allProgs);

  // Test 1: User in Psicología (id: 6) asks for Sistemas
  const t1 = detectOtherProgramQuery(normalizeChatbookText('muéstrame los proyectos de Ingeniería de Sistemas'), 6, allProgs);
  console.log('Test 1 (Psico asking Sistemas):', t1?.name || 'NULL', t1 ? 'BLOCKED OK' : 'FAILED');

  // Test 2: User in Psicología (id: 6) asks for "proyectos de ingenieria"
  const t2 = detectOtherProgramQuery(normalizeChatbookText('proyectos de ingenieria'), 6, allProgs);
  console.log('Test 2 (Psico asking ingenieria):', t2?.name || 'NULL', t2 ? 'BLOCKED OK' : 'FAILED');

  // Test 3: User in Psicología (id: 6) asks for "proyectos de sistemas"
  const t3 = detectOtherProgramQuery(normalizeChatbookText('proyectos de sistemas'), 6, allProgs);
  console.log('Test 3 (Psico asking sistemas):', t3?.name || 'NULL', t3 ? 'BLOCKED OK' : 'FAILED');

  // Test 4: User in Sistemas (id: 1) asks for Psicologia
  const t4 = detectOtherProgramQuery(normalizeChatbookText('muéstrame los proyectos de psicologia'), 1, allProgs);
  console.log('Test 4 (Sistemas asking psicologia):', t4?.name || 'NULL', t4 ? 'BLOCKED OK' : 'FAILED');

  // Test 5: User in Psicología (id: 6) asks for "cuáles son mis proyectos"
  const t5 = detectOtherProgramQuery(normalizeChatbookText('cuáles son mis proyectos'), 6, allProgs);
  console.log('Test 5 (Psico normal query):', t5 ? 'BLOCKED (WRONG)' : 'PASSED OK');

  // Test 6: User in Sistemas (id: 1) asks for "busca proyectos de inteligencia artificial"
  const t6 = detectOtherProgramQuery(normalizeChatbookText('busca proyectos sobre inteligencia artificial'), 1, allProgs);
  console.log('Test 6 (Sistemas normal search):', t6 ? 'BLOCKED (WRONG)' : 'PASSED OK');

  process.exit(0);
}

runTests();
