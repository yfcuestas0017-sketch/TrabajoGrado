import pool from '../server/db.js';

async function testLogin(email, password) {
  console.log(`\n🔍 Probando login para: "${email}" / "${password}"`);
  
  const query = `
    SELECT u.user_id, u.full_name, u.email, u.password, u.program_id,
           r.role_id, r.name as role_name, p.name as program_name
    FROM public.users u
    LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN public.roles r ON ur.role_id = r.role_id
    LEFT JOIN public.programs p ON u.program_id = p.program_id
    WHERE LOWER(u.email) = LOWER($1)
    LIMIT 1;
  `;
  
  const res = await pool.query(query, [email.trim()]);
  if (res.rows.length === 0) {
    console.log('❌ Usuario no encontrado en la base de datos.');
    return;
  }

  const user = res.rows[0];
  console.log('👤 Usuario encontrado:', user);
  
  if (user.password !== password.trim()) {
    console.log(`❌ Contraseña no coincide. Guardada: "${user.password}", Ingresada: "${password}"`);
  } else {
    console.log('✅ LOGIN EXITOSO!');
  }
}

async function main() {
  await testLogin('admin@unicesmag.edu.co', '12345678');
  await testLogin('admin@unicesmag.edu.co', '123456');
  await testLogin('calpa@unicesmag.edu.co', '12345678');
  await testLogin('lajojoa.2609@unicesmag.edu.co', '12345678');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
