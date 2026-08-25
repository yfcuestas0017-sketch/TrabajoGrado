import pool from '../server/db.js';

async function testQuestions() {
  // Get sample users: 1 admin, 1 docente, 1 estudiante
  const adminRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, r.name as role_name, pr.name as program_name
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    WHERE LOWER(r.name) LIKE '%admin%'
    LIMIT 1
  `);

  const teacherRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, r.name as role_name, pr.name as program_name
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    WHERE LOWER(r.name) LIKE '%docent%'
    LIMIT 1
  `);

  const studentRes = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, r.name as role_name, pr.name as program_name
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    LEFT JOIN public.programs pr ON pr.program_id = u.program_id
    WHERE LOWER(r.name) LIKE '%estudiant%'
    LIMIT 1
  `);

  const admin = adminRes.rows[0];
  const teacher = teacherRes.rows[0];
  const student = studentRes.rows[0];

  console.log('Test users:', {
    admin: admin ? `${admin.full_name} (${admin.user_id})` : 'None',
    teacher: teacher ? `${teacher.full_name} (${teacher.user_id})` : 'None',
    student: student ? `${student.full_name} (${student.user_id})` : 'None',
  });

  const queries = {
    admin: [
      '¿Qué proyectos están próximos a terminar?',
      '¿Qué proyectos comenzaron recientemente?',
      '¿Cuántos proyectos terminan este mes?',
      '¿Cuáles son las fechas de los proyectos?',
      'Muéstrame proyectos por fecha de finalización.',
      '¿Cuántos proyectos existen por estado?',
      '¿Qué proyectos están en ejecución?',
      '¿Qué proyectos están terminados?',
      '¿Qué proyectos están pendientes?',
      '¿Qué proyectos están disponibles?',
      '¿Cuántos proyectos existen actualmente?',
      'Muéstrame todos los proyectos.',
      '¿Cuántos proyectos existen?',
      'Busca proyectos por línea.',
      'Busca proyectos por estado.',
      'Busca proyectos por modalidad.',
      '¿Qué líneas de investigación existen?',
      '¿Cuántos proyectos tiene cada línea?',
      '¿Qué sublíneas existen?',
      '¿Qué docentes pertenecen a cada línea?',
      '¿Qué proyectos están asociados a cada línea?',
      '¿Qué docentes existen?',
      '¿Qué proyectos tiene asignado cada docente?',
      '¿Qué docentes tienen proyectos asociados?',
    ],
    docente: [
      '¿Cuándo terminan los proyectos que asesoro?',
      '¿Qué proyectos están próximos a terminar?',
      '¿Cuál es la fecha de inicio de este proyecto?',
      '¿Cuál es la fecha de finalización?',
      'Muéstrame las fechas de los proyectos que asesoro.',
      '¿Cuál es el estado de los proyectos que asesoro?',
      '¿Qué proyectos están en ejecución?',
      '¿Qué proyectos están terminados?',
      '¿Qué proyectos están pendientes?',
      '¿Cuántos proyectos tengo en cada estado?',
      '¿Qué proyectos tengo asignados?',
      '¿Qué proyectos asesoro?',
      '¿Qué proyectos existen en esta línea?',
      'Busca proyectos relacionados con esta temática.',
      '¿A qué línea pertenece este proyecto?',
      '¿Qué proyectos existen en mi línea?',
      '¿Qué sublíneas pertenecen a esta línea?',
      '¿Qué docentes pertenecen a esta línea?',
      '¿Qué estudiantes están asociados a mis proyectos?',
    ],
    estudiante: [
      '¿Cuándo inicia mi proyecto?',
      '¿Cuándo termina mi proyecto?',
      '¿Cuánto tiempo dura mi proyecto?',
      '¿Cuánto falta para que termine mi proyecto?',
      '¿Cuáles son las fechas de mis proyectos?',
      '¿Cuál de mis proyectos termina primero?',
      '¿Cuál de mis proyectos está próximo a terminar?',
      '¿Cuál es el estado de mi proyecto?',
      '¿Cuál es el estado de mis proyectos?',
      '¿Qué significa el estado de mi proyecto?',
      '¿Qué proyectos míos están en ejecución?',
      '¿Tengo algún proyecto terminado?',
      '¿Cuáles son mis proyectos?',
      '¿Qué proyectos están disponibles?',
      'Busca proyectos relacionados con mi línea.',
      'Busca proyectos sobre inteligencia artificial.',
      'Muéstrame proyectos similares.',
      '¿Cuál es mi línea de investigación?',
      '¿Cuál es la sublínea de mi proyecto?',
      '¿Qué proyectos existen en mi línea?',
      '¿Qué otras líneas existen?',
      '¿Quién es mi docente asesor?',
      '¿Qué docente está asociado a mi proyecto?',
      '¿Qué docentes pertenecen a mi línea?',
    ]
  };

  for (const [role, list] of Object.entries(queries)) {
    const user = role === 'admin' ? admin : (role === 'docente' ? teacher : student);
    if (!user) continue;
    console.log(`\n================= TESTING ROLE: ${role.toUpperCase()} (${user.full_name}) =================`);
    for (const q of list) {
      try {
        const res = await fetch('http://localhost:5000/api/chatbook/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.user_id, message: q })
        });
        const data = await res.json();
        const firstLine = (data.message || '').split('\n')[0];
        const isFallback = data.message?.includes('No encontré proyectos que coincidan') || data.message?.includes('No encuentro esta información');
        const statusIcon = isFallback ? '⚠️ [FALLBACK]' : '✅ [OK]';
        console.log(`${statusIcon} Q: "${q}" -> Resp: ${firstLine}`);
      } catch (err) {
        console.error(`❌ Error on "${q}":`, err.message);
      }
    }
  }

  await pool.end();
}

testQuestions();
