async function testSummary() {
  const studentId = '3fd36425-d73c-4887-b5ec-0853f999333a'; // Lizeth Jojoa (Estudiante)
  const docId = '5e740eae-09ff-4f61-b97a-c9d057d0ccbc'; // Luis (Docente)
  const adminId = 'b68f0759-1198-4a18-bc62-b6d7b88647dd'; // Admin

  const queries = [
    { label: '1. Quick: Banco de proyectos', userId: studentId, message: 'Muéstrame los proyectos disponibles.' },
    { label: '2. Quick: Mis proyectos', userId: studentId, message: 'Muéstrame mis proyectos.' },
    { label: '3. Quick: Líneas', userId: studentId, message: '¿Qué líneas de investigación existen?' },
    { label: '4. Quick: Docentes', userId: studentId, message: '¿Qué docentes están asociados a mis proyectos?' },
    { label: '5. Quick: Fechas', userId: studentId, message: '¿Cuándo terminan mis proyectos?' },
    { label: '6. Quick: Estados', userId: studentId, message: '¿Qué proyectos están disponibles?' },
    { label: '7. Specific Project P-001', userId: studentId, message: '¿Cuál es la información del proyecto P-001?' },
    { label: '8. Specific Line IA', userId: studentId, message: '¿Qué proyectos existen en la línea Inteligencia Artificial?' },
    { label: '9. Greeting: Hola', userId: studentId, message: 'Hola' },
    { label: '10. Search: Riego', userId: studentId, message: 'Riego' },
    { label: '11. Docente: Mis proyectos', userId: docId, message: 'Muéstrame mis proyectos.' },
    { label: '12. Docente: Líneas', userId: docId, message: '¿Qué líneas de investigación existen?' },
    { label: '13. Admin: Proyectos', userId: adminId, message: 'Muéstrame los proyectos disponibles.' },
    { label: '14. No userId', userId: null, message: 'Hola' },
    { label: '15. Invalid userId', userId: 'invalid-id-xyz', message: 'Hola' },
  ];

  for (const q of queries) {
    try {
      const res = await fetch('http://localhost:5000/api/chatbook/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: q.userId, message: q.message }),
      });
      const data = await res.json();
      console.log(`\n[${q.label}] HTTP ${res.status}`);
      console.log(`  Msg: "${data.message || data.error}"`);
      console.log(`  Projects count: ${data.projects?.length ?? 'N/A'}, Lines count: ${data.lines?.length ?? 'N/A'}`);
    } catch (err) {
      console.log(`\n[${q.label}] Error: ${err.message}`);
    }
  }
}

testSummary();
