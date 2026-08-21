import pool from '../server/db.js';

async function checkAllUsers() {
  const query = `
    SELECT u.user_id, u.full_name, u.email, u.password, u.program_id,
           r.role_id, r.name as role_name, p.name as program_name
    FROM public.users u
    LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN public.roles r ON ur.role_id = r.role_id
    LEFT JOIN public.programs p ON u.program_id = p.program_id
    ORDER BY u.full_name;
  `;
  const res = await pool.query(query);
  console.log(`📋 TODOS LOS USUARIOS REGISTRADOS EN BaseDatosGrado (${res.rows.length}):`);
  console.table(res.rows.map(u => ({
    Email: u.email,
    Nombre: u.full_name,
    Clave: u.password,
    Rol: u.role_name || 'Estudiante (por defecto)',
    Programa: u.program_name || 'Sin programa',
  })));
  process.exit(0);
}

checkAllUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
