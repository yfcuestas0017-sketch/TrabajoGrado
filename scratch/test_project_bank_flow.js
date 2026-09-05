import assert from 'assert';

async function testProjectBankFlow() {
  console.log('🧪 Iniciando pruebas automatizadas del Banco de Proyectos...');
  const baseUrl = 'http://localhost:5000/api';

  // 1. List project bank ideas
  console.log('▶ Test 1: Listar ideas');
  const listRes = await fetch(`${baseUrl}/project-bank`);
  assert.strictEqual(listRes.status, 200, 'Status debe ser 200');
  const listData = await listRes.json();
  assert(Array.isArray(listData), 'Debe ser un array');
  assert(listData.length >= 7, 'Debe haber al menos 7 ideas');
  console.log(`  ✓ Se obtuvieron ${listData.length} ideas.`);

  // 2. Get single project by id
  const sample = listData[0];
  console.log(`▶ Test 2: Obtener detalle del proyecto ID ${sample.project_bank_id}`);
  const detailRes = await fetch(`${baseUrl}/project-bank/${sample.project_bank_id}`);
  assert.strictEqual(detailRes.status, 200);
  const detailData = await detailRes.json();
  assert.strictEqual(detailData.title, sample.title);
  console.log(`  ✓ Detalle obtenido correctamente: "${detailData.title.slice(0, 40)}..."`);

  // 3. Create project bank idea by a teacher
  console.log('▶ Test 3: Crear nueva idea por un Docente');
  const newIdeaPayload = {
    title: 'Sistema de Detección de Phishing Mediante NLP y Transformers',
    description: 'Investigación orientada al entrenamiento de un modelo liviano basado en BERT para identificar correos de suplantación de identidad en tiempo real.',
    generalObjective: 'Construir un detector de correos fraudulentos de alta precisión.',
    specificObjectives: '1. Recolectar corpus de correos en español.\n2. Entrenar y evaluar modelo.\n3. Implementar plugin para clientes de correo.',
    researchLineId: 3, // Seguridad Informática
    researchSublineId: 9, // Ciberseguridad
    programId: 1, // Ingeniería de Sistemas
    keywords: 'NLP, Ciberseguridad, Phishing, Transformers',
    observations: 'Idea de prueba automatizada',
    userId: 'doc001',
    userRole: 'Docente',
  };
  const createRes = await fetch(`${baseUrl}/project-bank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newIdeaPayload),
  });
  assert.strictEqual(createRes.status, 201);
  const createdData = await createRes.json();
  assert(createdData.project_bank_id);
  assert.strictEqual(createdData.status, 'Disponible');
  assert.strictEqual(createdData.proposer_id, 'doc001');
  assert.strictEqual(createdData.proposer_role, 'Docente');
  console.log(`  ✓ Idea creada con ID: ${createdData.project_bank_id}`);

  // 4. Update project bank idea
  console.log('▶ Test 4: Editar idea por su docente proponente');
  const updateRes = await fetch(`${baseUrl}/project-bank/${createdData.project_bank_id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Sistema Avanzado de Detección de Phishing con Transformers (Actualizado)',
      description: 'Descripción actualizada con técnicas ensemble y validación cruzada.',
      userId: 'doc001',
      userRole: 'Docente',
      researchLineId: 3,
      researchSublineId: 9,
      programId: 1,
    }),
  });
  assert.strictEqual(updateRes.status, 200);
  const updatedData = await updateRes.json();
  assert.strictEqual(updatedData.title, 'Sistema Avanzado de Detección de Phishing con Transformers (Actualizado)');
  console.log('  ✓ Idea editada correctamente.');

  // 5. Change status (Desactivar / Reactivar) by admin
  console.log('▶ Test 5: Desactivar y Reactivar por Administrador');
  const toggleRes = await fetch(`${baseUrl}/project-bank/${createdData.project_bank_id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Inactivo', userRole: 'Administrador' }),
  });
  assert.strictEqual(toggleRes.status, 200);
  const toggledData = await toggleRes.json();
  assert.strictEqual(toggledData.status, 'Inactivo');
  console.log('  ✓ Estado cambiado a Inactivo');

  const reactivateRes = await fetch(`${baseUrl}/project-bank/${createdData.project_bank_id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Disponible', userRole: 'Administrador' }),
  });
  assert.strictEqual(reactivateRes.status, 200);
  const reactivatedData = await reactivateRes.json();
  assert.strictEqual(reactivatedData.status, 'Disponible');
  console.log('  ✓ Estado reactivado a Disponible');

  // 6. Student selects project
  // Use a student without project, e.g. est002
  console.log('▶ Test 6: Estudiante (est002) escoge el proyecto');
  const selectRes = await fetch(`${baseUrl}/project-bank/${createdData.project_bank_id}/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'est002' }),
  });
  assert.strictEqual(selectRes.status, 200);
  const selectData = await selectRes.json();
  assert.strictEqual(selectData.project.status, 'Asignado');
  assert.strictEqual(selectData.project.assigned_student_id, 'est002');
  assert(selectData.project.assigned_at);
  console.log('  ✓ Proyecto asignado exitosamente al estudiante est002');

  // 7. Verify student cannot select another project
  console.log('▶ Test 7: Verificar restricción (estudiante no puede escoger un segundo proyecto)');
  const availableProject = listData.find(p => p.status === 'Disponible' && p.project_bank_id !== createdData.project_bank_id);
  assert(availableProject, 'Debe haber otro proyecto disponible');
  const duplicateSelectRes = await fetch(`${baseUrl}/project-bank/${availableProject.project_bank_id}/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'est002' }),
  });
  assert.strictEqual(duplicateSelectRes.status, 400, 'Debe fallar con 400');
  const dupData = await duplicateSelectRes.json();
  assert(dupData.error.includes('Ya tienes un proyecto'));
  console.log(`  ✓ Restricción validada: "${dupData.error}"`);

  // 8. Verify getStudentAssignedProject for est002
  console.log('▶ Test 8: Consultar proyecto asignado del estudiante (para Mi proyecto de grado)');
  const studProjectRes = await fetch(`${baseUrl}/project-bank/student/est002`);
  assert.strictEqual(studProjectRes.status, 200);
  const studProjectData = await studProjectRes.json();
  assert.strictEqual(studProjectData.hasAssignedProject, true);
  assert.strictEqual(studProjectData.project.assigned_student_id, 'est002');
  assert.strictEqual(studProjectData.project.title, 'Sistema Avanzado de Detección de Phishing con Transformers (Actualizado)');
  console.log(`  ✓ Proyecto asignado cargado correctamente para perfil: "${studProjectData.project.title}"`);

  console.log('\n🎉 ¡TODAS LAS PRUEBAS AUTOMATIZADAS PASARON EXITOSAMENTE!');
}

testProjectBankFlow().catch((err) => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
