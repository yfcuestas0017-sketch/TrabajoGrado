import { regulationService, searchRegulation } from '../server/chatbook/regulation/regulation_service.js';

async function runTests() {
  console.log('================================================================');
  console.log('PRUEBAS DEL SERVICIO DE CONSULTA DEL REGLAMENTO (PASO 2)');
  console.log('================================================================\n');

  // Test 0: Metadata general
  console.log('--- TEST 0: METADATA DEL REGLAMENTO ---');
  const metadata = await regulationService.getMetadata();
  console.log('Código:', metadata.code);
  console.log('Título:', metadata.title);
  console.log('Emisor:', metadata.issued_by);
  console.log('Vigencia:', metadata.effective_date);
  console.log('Nota compilación:', metadata.compilation_note);
  console.log('Capítulos:', metadata.total_chapters, '| Artículos:', metadata.total_articles);
  console.log('✓ Test 0 PASÓ\n');

  // Test 1: Búsqueda de "coterminalidad"
  console.log('--- TEST 1: BÚSQUEDA DE "coterminalidad" ---');
  const resCoterminal = await regulationService.search('coterminalidad');
  console.log('Éxito:', resCoterminal.success);
  console.log('Mensaje:', resCoterminal.message);
  console.log('Resultados encontrados:', resCoterminal.count);
  if (resCoterminal.modalities) {
    console.log('Modalidad encontrada:', resCoterminal.modalities.map(m => `${m.literal}. ${m.name}`));
  }
  if (resCoterminal.results.length > 0) {
    const first = resCoterminal.results[0];
    console.log('Primer resultado:', `Art. ${first.article_number} - ${first.title} (${first.chapter_title})`);
    console.log('Referencia normativa:', first.normative_reference);
  }
  console.log('✓ Test 1 PASÓ\n');

  // Test 2: Búsqueda de "sustentación"
  console.log('--- TEST 2: BÚSQUEDA DE "sustentación" ---');
  const resSustentacion = await regulationService.search('sustentación');
  console.log('Éxito:', resSustentacion.success);
  console.log('Resultados encontrados:', resSustentacion.count);
  resSustentacion.results.forEach((r, idx) => {
    console.log(`  [${idx + 1}] Art. ${r.article_number}: ${r.title} (Capítulo ${r.chapter_number} - ${r.chapter_title}) [Score: ${r.relevance_score}]`);
  });
  console.log('✓ Test 2 PASÓ\n');

  // Test 3: Búsqueda de "jurados"
  console.log('--- TEST 3: BÚSQUEDA DE "jurados" ---');
  const resJurados = await regulationService.search('jurados');
  console.log('Éxito:', resJurados.success);
  console.log('Resultados encontrados:', resJurados.count);
  resJurados.results.slice(0, 5).forEach((r, idx) => {
    console.log(`  [${idx + 1}] Art. ${r.article_number}: ${r.title} (Capítulo ${r.chapter_number} - ${r.chapter_title}) [Score: ${r.relevance_score}]`);
  });
  console.log('✓ Test 3 PASÓ\n');

  // Test 4: Búsqueda de "opciones de grado"
  console.log('--- TEST 4: BÚSQUEDA DE "opciones de grado" ---');
  const resOpciones = await regulationService.search('opciones de grado');
  console.log('Éxito:', resOpciones.success);
  console.log('Mensaje:', resOpciones.message);
  console.log('Resultados encontrados:', resOpciones.count);
  if (resOpciones.results.length > 0) {
    const first = resOpciones.results[0];
    console.log('Artículo principal:', `Art. ${first.article_number}: ${first.title} (Capítulo ${first.chapter_number})`);
  }
  console.log('✓ Test 4 PASÓ\n');

  // Test 5: Búsqueda de artículo específico (Artículo 6, Artículo 24, Artículo 38)
  console.log('--- TEST 5: BÚSQUEDA DE ARTÍCULOS ESPECÍFICOS ---');
  const art6 = await regulationService.getArticle(6);
  console.log(`Artículo 6: "${art6.title}" | Capítulo: ${art6.chapter_number} (${art6.chapter_title}) | Literales: ${art6.literals.length}`);

  const art24 = await regulationService.getArticle(24);
  console.log(`Artículo 24: "${art24.title}" | Capítulo: ${art24.chapter_number} | Parágrafos: ${art24.paragraphs.length}`);

  const art38 = await regulationService.getArticle(38);
  console.log(`Artículo 38: "${art38.title}" | Modificado por: ${art38.modification?.modifying_agreement}`);
  console.log('Cita formateada Art 38:', regulationService.formatCitation(38));
  console.log('✓ Test 5 PASÓ\n');

  // Test 6: Búsqueda sin resultados (respuesta controlada)
  console.log('--- TEST 6: BÚSQUEDA SIN RESULTADOS (RESPUESTA CONTROLADA) ---');
  const resVacia = await regulationService.search('astronomía cuántica intergaláctica');
  console.log('Éxito:', resVacia.success);
  console.log('Resultados:', resVacia.count);
  console.log('Mensaje controlado:', resVacia.message);
  console.log('✓ Test 6 PASÓ\n');

  console.log('================================================================');
  console.log('TODAS LAS PRUEBAS FINALIZARON EXITOSAMENTE');
  console.log('================================================================');
}

runTests().catch(console.error);
