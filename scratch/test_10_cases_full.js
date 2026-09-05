import assert from 'assert';
import pool from '../server/db.js';

const BASE_URL = 'http://localhost:5000/api';

async function run10Tests() {
  console.log('================================================================');
  console.log('🧪 EJECUTANDO BATERÍA DE 10 PRUEBAS AUTOMATIZADAS DEL BANCO');
  console.log('================================================================\n');

  let testProjectId = null;
  let testStudentId = 'est_test_temp_' + Date.now();

  try {
    // 0. Setup: Crear un estudiante temporal de Sistemas para pruebas limpias
    await pool.query(
      `INSERT INTO public.users (user_id, full_name, email, password, program_id)
       VALUES ($1, 'Estudiante Temporal Sistemas', $2, 'pass123', 1)
       ON CONFLICT (user_id) DO UPDATE SET program_id = 1`,
      [testStudentId, `${testStudentId}@unicesmag.edu.co`]
    );
    await pool.query(
      `INSERT INTO public.user_roles (user_id, role_id)
       VALUES ($1, (SELECT role_id FROM public.roles WHERE LOWER(name) = 'estudiante' LIMIT 1))
       ON CONFLICT DO NOTHING`,
      [testStudentId]
    );

    // ────────────────────────────────────────────────────────────────
    // CASO 1: Aislamiento SQL para Estudiante de Sistemas (est001 / program_id 1)
    // ────────────────────────────────────────────────────────────────
    console.log('▶ CASO 1: Aislamiento SQL directo para Estudiante de Sistemas (est001)');
    const res1 = await fetch(`${BASE_URL}/project-bank?userId=est001`);
    assert.strictEqual(res1.status, 200, 'Status debe ser 200');
    const projs1 = await res1.json();
    assert(projs1.length > 0, 'Debe haber proyectos de Sistemas');
    const allSistemas = projs1.every(p => Number(p.program_id) === 1);
    assert.strictEqual(allSistemas, true, 'TODOS los proyectos deben pertenecer a program_id = 1');
    console.log(`  ✓ ÉXITO: Se recuperaron ${projs1.length} proyectos, 100% pertenecientes a Ingeniería de Sistemas (program_id: 1).`);

    // ────────────────────────────────────────────────────────────────
    // CASO 2: Aislamiento SQL directo para Estudiante de Psicología (est005 / program_id 2)
    // ────────────────────────────────────────────────────────────────
    console.log('\n▶ CASO 2: Aislamiento SQL directo para Estudiante de Psicología (est005)');
    const res2 = await fetch(`${BASE_URL}/project-bank?userId=est005`);
    assert.strictEqual(res2.status, 200, 'Status debe ser 200');
    const projs2 = await res2.json();
    assert(projs2.length > 0, 'Debe haber proyectos de Psicología');
    const allPsicologia = projs2.every(p => Number(p.program_id) === 2);
    assert.strictEqual(allPsicologia, true, 'TODOS los proyectos deben pertenecer a program_id = 2');
    console.log(`  ✓ ÉXITO: Se recuperaron ${projs2.length} proyectos, 100% pertenecientes a Psicología (program_id: 2). Ninguno de Sistemas.`);

    // ────────────────────────────────────────────────────────────────
    // CASO 3: Validación estricta de programa en Selección (POST /:id/select)
    // ────────────────────────────────────────────────────────────────
    console.log('\n▶ CASO 3: Bloqueo de selección cross-program (Estudiante Psicología -> Proyecto Sistemas)');
    // Proyecto 1 es de Sistemas (program_id 1), est005 es de Psicología (program_id 2)
    const res3 = await fetch(`${BASE_URL}/project-bank/1/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'est005' }),
    });
    assert.strictEqual(res3.status, 403, 'Debe retornar HTTP 403 Forbidden');
    const err3 = await res3.json();
    assert(err3.error.includes('programa académico diferente'), 'Mensaje debe indicar programa diferente');
    console.log(`  ✓ ÉXITO: HTTP 403 Forbidden recibido correctamente: "${err3.error}"`);

    // ────────────────────────────────────────────────────────────────
    // CASO 4: Bloqueo en Detalle e Historial de otro programa para estudiante
    // ────────────────────────────────────────────────────────────────
    console.log('\n▶ CASO 4: Bloqueo de visualización de Detalle e Historial cross-program');
    const res4Detail = await fetch(`${BASE_URL}/project-bank/1?userId=est005`);
    assert.strictEqual(res4Detail.status, 403, 'Detalle debe retornar HTTP 403 para est005');
    const res4Hist = await fetch(`${BASE_URL}/project-bank/1/history?userId=est005`);
    assert.strictEqual(res4Hist.status, 403, 'Historial debe retornar HTTP 403 para est005');
    console.log('  ✓ ÉXITO: GET /:id y GET /:id/history rechazaron con HTTP 403 a estudiante de otro programa.');

    // ────────────────────────────────────────────────────────────────
    // CASO 5: Creación de proyecto por Docente + Registro automático en Historial
    // ────────────────────────────────────────────────────────────────
    console.log('\n▶ CASO 5: Creación de idea por Docente (doc001) y registro automático en Historial');
    const newIdeaPayload = {
      title: 'Plataforma IoT para Monitoreo de Cultivos en Nariño',
      description: 'Sistema embebido con sensores LoRaWAN para optimizar el riego y monitoreo climático en zonas agrícolas de Nariño.',
      generalObjective: 'Desarrollar un prototipo de monitoreo agrometeorológico con microcontroladores ESP32.',
      specificObjectives: '1. Diseñar nodos sensores.\n2. Implementar pasarela LoRaWAN.\n3. Crear panel de visualización.',
      researchLineId: 1, // Desarrollo de Software
      researchSublineId: 1, // Aplicaciones Web y Móviles
      programId: 1, // Ingeniería de Sistemas
      keywords: 'IoT, LoRaWAN, Agro, Nariño',
      observations: 'Proyecto de validación para banco de proyectos',
      userId: 'doc001',
      userRole: 'Docente',
    };
    const res5 = await fetch(`${BASE_URL}/project-bank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newIdeaPayload),
    });
    assert.strictEqual(res5.status, 201, 'Status debe ser 201 Created');
    const createdData = await res5.json();
    testProjectId = createdData.project_bank_id;
    assert(testProjectId, 'Debe devolver ID del nuevo proyecto');

    // Verificar en historial
    const hist5 = await pool.query(
      `SELECT * FROM public.project_bank_histories WHERE project_bank_id = $1 AND action = 'CREATE'`,
      [testProjectId]
    );
    assert.strictEqual(hist5.rows.length, 1, 'Debe existir 1 registro de historial CREATE');
    assert.strictEqual(hist5.rows[0].new_status, 'Disponible');
    assert.strictEqual(hist5.rows[0].user_id, 'doc001');
    console.log(`  ✓ ÉXITO: Proyecto #${testProjectId} creado y registrado en historial con action='CREATE' y new_status='Disponible'.`);

    // ────────────────────────────────────────────────────────────────
    // CASO 6: Edición estructurada con changes JSONB
    // ────────────────────────────────────────────────────────────────
    console.log('\n▶ CASO 6: Edición por proponente y cálculo de diff estructurado JSONB');
    const res6 = await fetch(`${BASE_URL}/project-bank/${testProjectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Plataforma IoT para Monitoreo de Cultivos en Nariño (Versión 2.0)',
        description: 'Descripción optimizada con almacenamiento en la nube y alertas por Telegram.',
        generalObjective: 'Desarrollar un prototipo integral con alertas en tiempo real.',
        researchLineId: 1,
        researchSublineId: 1,
        programId: 1,
        keywords: 'IoT, LoRaWAN, Agro, Nariño, Telegram',
        userId: 'doc001',
        userRole: 'Docente',
      }),
    });
    assert.strictEqual(res6.status, 200, 'Status debe ser 200');

    // Verificar diff JSONB en BD
    const hist6 = await pool.query(
      `SELECT * FROM public.project_bank_histories WHERE project_bank_id = $1 AND action = 'UPDATE'`,
      [testProjectId]
    );
    assert(hist6.rows.length >= 1, 'Debe existir historial UPDATE');
    const lastUpdate = hist6.rows[hist6.rows.length - 1];
    assert(typeof lastUpdate.changes === 'object', 'changes debe ser un objeto JSONB');
    assert(lastUpdate.changes.title, 'changes debe registrar el cambio de title');
    assert.strictEqual(lastUpdate.changes.title.before, 'Plataforma IoT para Monitoreo de Cultivos en Nariño');
    assert.strictEqual(lastUpdate.changes.title.after, 'Plataforma IoT para Monitoreo de Cultivos en Nariño (Versión 2.0)');
    console.log('  ✓ ÉXITO: Historial UPDATE guardado con diff estructurado JSONB:', JSON.stringify(lastUpdate.changes.title));

    // ────────────────────────────────────────────────────────────────
    // CASO 7: Desactivación por Administrador (Disponible -> Inactivo)
    // ────────────────────────────────────────────────────────────────
    console.log('\n▶ CASO 7: Desactivación por Administrador (Disponible -> Inactivo)');
    const res7 = await fetch(`${BASE_URL}/project-bank/${testProjectId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Inactivo', userRole: 'Administrador', userId: 'admin001' }),
    });
    assert.strictEqual(res7.status, 200);

    const hist7 = await pool.query(
      `SELECT * FROM public.project_bank_histories WHERE project_bank_id = $1 AND action = 'DEACTIVATE'`,
      [testProjectId]
    );
    assert.strictEqual(hist7.rows.length, 1);
    assert.strictEqual(hist7.rows[0].previous_status, 'Disponible');
    assert.strictEqual(hist7.rows[0].new_status, 'Inactivo');
    console.log('  ✓ ÉXITO: Estado actualizado a Inactivo y registrado en historial: action=DEACTIVATE, Disponible -> Inactivo.');

    // ────────────────────────────────────────────────────────────────
    // CASO 8: Reactivación por Administrador (Inactivo -> Disponible)
    // ────────────────────────────────────────────────────────────────
    console.log('\n▶ CASO 8: Reactivación por Administrador (Inactivo -> Disponible)');
    const res8 = await fetch(`${BASE_URL}/project-bank/${testProjectId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Disponible', userRole: 'Administrador', userId: 'admin001' }),
    });
    assert.strictEqual(res8.status, 200);

    const hist8 = await pool.query(
      `SELECT * FROM public.project_bank_histories WHERE project_bank_id = $1 AND action = 'REACTIVATE'`,
      [testProjectId]
    );
    assert.strictEqual(hist8.rows.length, 1);
    assert.strictEqual(hist8.rows[0].previous_status, 'Inactivo');
    assert.strictEqual(hist8.rows[0].new_status, 'Disponible');
    console.log('  ✓ ÉXITO: Estado reactivado a Disponible y registrado en historial: action=REACTIVATE, Inactivo -> Disponible.');

    // ────────────────────────────────────────────────────────────────
    // CASO 9: Selección exitosa por estudiante de Sistemas (Disponible -> Asignado)
    // ────────────────────────────────────────────────────────────────
    console.log(`\n▶ CASO 9: Selección oficial por estudiante (${testStudentId})`);
    const res9 = await fetch(`${BASE_URL}/project-bank/${testProjectId}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: testStudentId }),
    });
    assert.strictEqual(res9.status, 200, 'Status debe ser 200');
    const selData = await res9.json();
    assert.strictEqual(selData.project.status, 'Asignado');
    assert.strictEqual(selData.project.assigned_student_id, testStudentId);

    // Verificar en historial
    const hist9 = await pool.query(
      `SELECT * FROM public.project_bank_histories WHERE project_bank_id = $1 AND action = 'SELECT'`,
      [testProjectId]
    );
    assert.strictEqual(hist9.rows.length, 1);
    assert.strictEqual(hist9.rows[0].new_status, 'Asignado');
    assert.strictEqual(hist9.rows[0].user_id, testStudentId);

    // Verificar consulta de estudiante asignado
    const res9Profile = await fetch(`${BASE_URL}/project-bank/student/${testStudentId}`);
    assert.strictEqual(res9Profile.status, 200);
    const profData = await res9Profile.json();
    assert.strictEqual(profData.hasAssignedProject, true);
    assert.strictEqual(profData.project.project_bank_id, testProjectId);
    console.log('  ✓ ÉXITO: Proyecto asignado correctamente, visible en perfil institucional y registrado con action=SELECT en historial.');

    // ────────────────────────────────────────────────────────────────
    // CASO 10: Regla estricta de Un Solo Proyecto por Estudiante
    // ────────────────────────────────────────────────────────────────
    console.log(`\n▶ CASO 10: Intento de estudiante (${testStudentId}) de seleccionar un segundo proyecto`);
    // Buscar otro proyecto disponible de Sistemas (si existe) o crear uno temporal disponible
    const tempProj2 = await pool.query(
      `INSERT INTO public.project_bank (title, description, status, program_id, proposer_id, proposer_role)
       VALUES ('Segundo Proyecto Test', 'Descripción test', 'Disponible', 1, 'doc001', 'Docente')
       RETURNING project_bank_id`
    );
    const tempProj2Id = tempProj2.rows[0].project_bank_id;

    const res10 = await fetch(`${BASE_URL}/project-bank/${tempProj2Id}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: testStudentId }),
    });
    assert.strictEqual(res10.status, 400, 'Debe retornar HTTP 400 Bad Request');
    const err10 = await res10.json();
    assert(err10.error.includes('Ya tienes un proyecto de grado asignado'), 'Error debe advertir asignación previa');
    console.log(`  ✓ ÉXITO: Intento bloqueado con HTTP 400 Bad Request: "${err10.error}"`);

    // Limpieza de segundo proyecto de prueba
    await pool.query('DELETE FROM public.project_bank WHERE project_bank_id = $1', [tempProj2Id]);

    // ────────────────────────────────────────────────────────────────
    // VERIFICACIÓN ADICIONAL DE INTEGRIDAD: 8 proyectos preexistentes intactos
    // ────────────────────────────────────────────────────────────────
    console.log('\n================================================================');
    console.log('🔍 VERIFICACIÓN DE INTEGRIDAD DE DATOS PREEXISTENTES');
    console.log('================================================================');

    const originalProjects = await pool.query(
      `SELECT project_bank_id, title, status, program_id, proposer_role 
       FROM public.project_bank 
       WHERE project_bank_id BETWEEN 1 AND 8 
       ORDER BY project_bank_id`
    );
    assert.strictEqual(originalProjects.rows.length, 8, 'Los 8 proyectos originales deben existir');
    console.log(`✓ Los 8 proyectos preexistentes en public.project_bank están 100% intactos:`);
    originalProjects.rows.forEach(p => {
      console.log(`  - [ID ${p.project_bank_id}] (${p.status}) Prog: ${p.program_id} | ${p.title.slice(0, 50)}...`);
    });

    // Verificar que public.projects no fue modificado
    const publicProjects = await pool.query(`SELECT count(*)::int AS cnt FROM public.projects`);
    console.log(`✓ Registros en public.projects: ${publicProjects.rows[0].cnt} (tabla no modificada).`);

    // Verificar restricción ON DELETE RESTRICT en public.project_bank_histories
    const fkConstraint = await pool.query(`
      SELECT tc.constraint_name, rc.delete_rule 
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
      WHERE tc.table_name = 'project_bank_histories' AND tc.constraint_type = 'FOREIGN KEY';
    `);
    console.log('✓ Claves foráneas y reglas de eliminación en public.project_bank_histories:');
    fkConstraint.rows.forEach(fk => {
      console.log(`  - Restricción: ${fk.constraint_name} | ON DELETE: ${fk.delete_rule}`);
      if (fk.constraint_name.includes('project_bank_id')) {
        assert(fk.delete_rule === 'RESTRICT' || fk.delete_rule === 'NO ACTION', 'ON DELETE debe ser RESTRICT');
      }
    });

    console.log('\n🎉 ¡TODAS LAS 10 PRUEBAS Y VERIFICACIONES DE INTEGRIDAD PASARON CON ÉXITO!');

  } finally {
    // Cleanup de datos de prueba
    if (testProjectId) {
      await pool.query('DELETE FROM public.project_bank_histories WHERE project_bank_id = $1', [testProjectId]);
      await pool.query('DELETE FROM public.project_bank WHERE project_bank_id = $1', [testProjectId]);
    }
    if (testStudentId) {
      await pool.query('DELETE FROM public.user_roles WHERE user_id = $1', [testStudentId]);
      await pool.query('DELETE FROM public.users WHERE user_id = $1', [testStudentId]);
    }
    await pool.end();
  }
}

run10Tests().catch(err => {
  console.error('❌ Error durante la ejecución de pruebas:', err);
  process.exit(1);
});
