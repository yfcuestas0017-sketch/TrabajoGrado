import { getSupabaseClient } from './client';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getLoginError(error) {
  if (!error) return 'No fue posible iniciar sesión.';

  // Muestra el código y mensaje real en consola para diagnóstico
  console.error('[Supabase Auth] Error en login:', {
    code: error.code,
    status: error.status,
    message: error.message,
  });

  const msg = typeof error.message === 'string' ? error.message.toLowerCase() : '';

  // Email no confirmado → error específico (NO mezclar con credenciales incorrectas)
  if (msg.includes('email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.';
  }

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials')
  ) {
    return 'Correo o contraseña incorrectos. Verifica tus datos.';
  }

  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'No fue posible conectar con Supabase. Verifica tu conexión.';
  }

  if (msg.includes('too many requests')) {
    return 'Demasiados intentos. Espera unos minutos antes de intentarlo de nuevo.';
  }

  // Devuelve el mensaje original de Supabase si no se reconoce
  return error.message?.trim() || 'No fue posible iniciar sesión.';
}

// ─── login ────────────────────────────────────────────────────────────────────

/**
 * Inicia sesión usando Supabase Auth (auth.users).
 * Luego consulta el perfil extendido en public.users (vinculado por UUID).
 */
export async function signInWithUsersTable(email, password) {
  const supabase = getSupabaseClient();

  console.log('[Supabase Auth] Intentando login con email:', email);

  // 1. Autenticación oficial con Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (authError) {
    throw new Error(getLoginError(authError));
  }

  const authUser = authData?.user;
  if (!authUser?.id) {
    throw new Error('La respuesta del login no devolvió un usuario válido.');
  }

  console.log('[Supabase Auth] Login exitoso. user_id:', authUser.id);

  // 2. Perfil extendido desde public.users (user_id = UUID de auth.users)
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('user_id, full_name, email, program_id')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (profileError) {
    console.warn('[Supabase Auth] No se pudo cargar perfil público:', profileError.message);
  }

  // 3. Obtener rol real
  let roleName = 'usuario'; // default
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (!roleError && roleData?.roles) {
    const rName = Array.isArray(roleData.roles) ? roleData.roles[0]?.name : roleData.roles.name;
    if (rName) {
      roleName = rName.toLowerCase();
    }
  }

  return {
    id: authUser.id,                                    // UUID
    name: profile?.full_name || authUser.email,
    email: authUser.email,
    role: roleName,
    faculty: null,
    programId: profile?.program_id ?? null,
    avatar: null,
    authMode: 'database',
  };
}
