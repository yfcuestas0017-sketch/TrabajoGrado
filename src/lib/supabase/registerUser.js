/**
 * registerUser.js
 * Registro de nuevos estudiantes usando Supabase Auth al 100%.
 *
 * Flujo:
 *  1. supabase.auth.signUp() → crea el usuario en auth.users.
 *     El TRIGGER on_auth_user_created inserta automáticamente en public.users
 *     (user_id UUID, full_name, email).
 *  2. Actualiza public.users.program_id (el trigger no lo conoce).
 *  3. Resuelve curriculum_id activo del programa en academic_curricula.
 *  4. Inserta en students (user_id UUID, semester_id, curriculum_id).
 *  5. Busca role_id "Estudiante" en roles y lo asigna en user_roles.
 *  6. Devuelve objeto normalizado para AuthContext.
 */

import { getSupabaseClient } from './client';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getRegisterError(error) {
  if (!error) return 'No fue posible crear la cuenta.';

  const msg = typeof error.message === 'string' ? error.message.toLowerCase() : '';

  if (msg.includes('user already registered') || msg.includes('already registered')) {
    return 'Este correo ya está registrado. Intenta iniciar sesión.';
  }
  if (msg.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'No fue posible conectar con Supabase. Verifica tu conexión.';
  }

  return error.message?.trim() || 'No fue posible crear la cuenta.';
}

// ─── catálogos ────────────────────────────────────────────────────────────────

/** Devuelve todos los programas { program_id, name } */
export async function fetchPrograms() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('programs')
    .select('program_id, name')
    .order('name', { ascending: true });

  if (error) throw new Error('No se pudieron cargar los programas.');
  return data ?? [];
}

/** Devuelve todos los semestres { semester_id, semester_number } */
export async function fetchSemesters() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('semesters')
    .select('semester_id, semester_number')
    .order('semester_number', { ascending: true });

  if (error) throw new Error('No se pudieron cargar los semestres.');
  return data ?? [];
}

/**
 * Devuelve currículos activos de un programa.
 * Si length === 1 → se resuelve automáticamente.
 * Si length > 1  → el front muestra el 6.° campo selector.
 */
export async function fetchActiveCurricula(programId) {
  if (!programId) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('academic_curricula')
    .select('curriculum_id, version, effective_year')
    .eq('program_id', programId)
    .eq('status', 'activo')
    .order('effective_year', { ascending: false });

  if (error) throw new Error('No se pudieron cargar los currículos.');
  return data ?? [];
}

// ─── registro ─────────────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.fullName
 * @param {string} params.email
 * @param {string} params.password
 * @param {number} params.programId
 * @param {number} params.semesterId
 * @param {number|null} params.curriculumId  – null si solo hay un currículo activo
 */
export async function registerStudent({
  fullName,
  email,
  password,
}) {
  const supabase = getSupabaseClient();

  // 1. Registrar en Supabase Auth (crea auth.users + dispara trigger → public.users)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        // El trigger lee raw_user_meta_data->>'full_name'
        full_name: fullName.trim(),
      },
    },
  });

  if (authError) {
    throw new Error(getRegisterError(authError));
  }

  const authUser = authData?.user;
  if (!authUser?.id) {
    throw new Error('No se obtuvo un usuario válido tras el registro.');
  }

  const userId = authUser.id; // UUID



  // 5. Asignar rol "Estudiante" automáticamente (ID 3)
  const { error: roleError } = await supabase.from('user_roles').insert({
    user_id: userId,
    role_id: 3,
  });

  if (roleError) {
    console.error('[Registro] No se pudo asignar el rol de estudiante (ID 3):', roleError.message);
  }

  // 3. Devolver usuario normalizado para AuthContext
  return {
    id: userId,
    name: fullName.trim(),
    email: email.trim().toLowerCase(),
    role: 'estudiante',
    faculty: null,
    programId: null,
    avatar: null,
    authMode: 'database',
  };
}
