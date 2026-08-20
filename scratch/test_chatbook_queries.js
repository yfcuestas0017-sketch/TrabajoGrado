async function test() {
  const userId = '3fd36425-d73c-4887-b5ec-0853f999333a'; // Lizeth Jojoa (Estudiante)
  const docId = '5e740eae-09ff-4f61-b97a-c9d057d0ccbc'; // Luis (Docente)
  const adminId = 'b68f0759-1198-4a18-bc62-b6d7b88647dd'; // Admin

  const queries = [
    { label: 'Quick: Banco de proyectos', userId, message: 'Muéstrame los proyectos disponibles.' },
    { label: 'Quick: Mis proyectos', userId, message: 'Muéstrame mis proyectos.' },
    { label: 'Quick: Líneas', userId, message: '¿Qué líneas de investigación existen?' },
    { label: 'Quick: Docentes', userId, message: '¿Qué docentes están asociados a mis proyectos?' },
    { label: 'Quick: Fechas', userId, message: '¿Cuándo terminan mis proyectos?' },
    { label: 'Quick: Estados', userId, message: '¿Qué proyectos están disponibles?' },
    { label: 'Specific Project', userId, message: '¿Cuál es la información del proyecto P-001?' },
    { label: 'Specific Line', userId, message: '¿Qué proyectos existen en la línea Inteligencia Artificial?' },
    { label: 'General query', userId, message: 'Hola' },
    { label: 'Search term', userId, message: 'Riego' },
    { label: 'Teacher query', userId: docId, message: 'Muéstrame mis proyectos.' },
    { label: 'Admin query', userId: adminId, message: 'Muéstrame los proyectos disponibles.' },
    { label: 'Empty or undefined user', userId: '', message: 'hola' },
  ];

  for (const q of queries) {
    try {
      console.log(`\n=== Testing [${q.label}] with msg: "${q.message}" ===`);
      const res = await fetch('http://localhost:5000/api/chatbook/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: q.userId, message: q.message }),
      });
      const data = await res.json();
      console.log(`Status: ${res.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Fetch error:', err.message);
    }
  }
}

test();
