import pool from '../server/db.js';

async function inspect() {
  console.log('==================================================');
  console.log('INSPECCIÓN DE BASE DE DATOS: BaseDatosGrado');
  console.log('==================================================\n');

  // 1. Tablas en public
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  console.log('📋 TABLAS ENCONTRADAS (' + tables.rows.length + '):');
  console.log(tables.rows.map(t => '  - ' + t.table_name).join('\n'));
  console.log('\n--------------------------------------------------\n');

  // 2. Estructura y datos de roles
  const roles = await pool.query('SELECT * FROM public.roles ORDER BY role_id;').catch(e => e);
  console.log('👥 ROLES REGISTRADOS:');
  if (roles.rows) console.table(roles.rows);
  else console.log('Error o no existe:', roles.message);

  // 3. Estructura y datos de permisos
  const permissions = await pool.query('SELECT * FROM public.permissions ORDER BY permission_id;').catch(e => e);
  console.log('\n🔑 PERMISOS REGISTRADOS:');
  if (permissions.rows) console.table(permissions.rows);
  else console.log('Error o no existe:', permissions.message);

  // 4. Role Permissions
  const rolePerms = await pool.query(`
    SELECT rp.role_permission_id, r.name as role_name, p.name as permission_name
    FROM public.role_permissions rp
    JOIN public.roles r ON rp.role_id = r.role_id
    JOIN public.permissions p ON rp.permission_id = p.permission_id;
  `).catch(e => e);
  console.log('\n🛡️ ASIGNACIÓN ROLES-PERMISOS:');
  if (rolePerms.rows) console.table(rolePerms.rows);
  else console.log('Error o no existe:', rolePerms.message);

  // 5. Usuarios y sus Roles
  const usersWithRoles = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.program_id, r.name as role_name
    FROM public.users u
    LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN public.roles r ON ur.role_id = r.role_id
    ORDER BY u.user_id
    LIMIT 10;
  `).catch(e => e);
  console.log('\n👤 USUARIOS Y ROLES ASIGNADOS (MUESTRA):');
  if (usersWithRoles.rows) console.table(usersWithRoles.rows);
  else console.log('Error o no existe:', usersWithRoles.message);

  // 6. Proyectos registrados
  const projectsCount = await pool.query('SELECT COUNT(*) FROM public.projects;').catch(e => e);
  console.log('\n📁 CONTEO DE PROYECTOS:', projectsCount.rows?.[0]?.count || 0);

  // 7. Facultades y Programas
  const programs = await pool.query(`
    SELECT p.program_id, p.name as program_name, f.name as faculty_name
    FROM public.programs p
    LEFT JOIN public.faculties f ON p.faculty_id = f.faculty_id;
  `).catch(e => e);
  console.log('\n🏛️ PROGRAMAS Y FACULTADES:');
  if (programs.rows) console.table(programs.rows);

  // 8. Triggers & Funciones de Auditoría
  const triggers = await pool.query(`
    SELECT trigger_name, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public';
  `).catch(e => e);
  console.log('\n⚙️ TRIGGERS DE AUDITORÍA:');
  if (triggers.rows) console.table(triggers.rows);

  // 9. Políticas RLS
  const rlsPolicies = await pool.query(`
    SELECT schemaname, tablename, policyname, roles, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public';
  `).catch(e => e);
  console.log('\n🔒 POLÍTICAS RLS (Row Level Security):');
  if (rlsPolicies.rows) console.table(rlsPolicies.rows);
  else console.log('Sin políticas RLS o no accesible.');

  process.exit(0);
}

inspect().catch(err => {
  console.error('Inspection Error:', err);
  process.exit(1);
});
