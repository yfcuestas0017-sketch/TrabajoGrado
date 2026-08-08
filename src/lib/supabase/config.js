const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

const resolvedKey = supabasePublishableKey || supabaseAnonKey;
const supabaseConfigAttempt = Boolean(
  supabaseUrl || supabasePublishableKey || supabaseAnonKey,
);

function isValidSupabaseUrl(value) {
  if (!value) return false;

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
  } catch {
    return false;
  }
}

function getSupabaseConfigError() {
  if (!supabaseConfigAttempt) return '';

  if (!supabaseUrl) {
    return 'Falta VITE_SUPABASE_URL en .env.local.';
  }

  if (!isValidSupabaseUrl(supabaseUrl)) {
    return 'VITE_SUPABASE_URL no tiene un formato valido.';
  }

  if (!resolvedKey) {
    return 'Falta VITE_SUPABASE_PUBLISHABLE_KEY en .env.local. Si tu proyecto usa llaves antiguas, puedes usar VITE_SUPABASE_ANON_KEY.';
  }

  return '';
}

export const hasSupabaseConfigAttempt = supabaseConfigAttempt;
export const supabaseConfigError = getSupabaseConfigError();
export const hasSupabaseConfig = Boolean(
  supabaseUrl && resolvedKey && !supabaseConfigError,
);

export function getSupabaseConfig() {
  if (!hasSupabaseConfig) {
    throw new Error(
      supabaseConfigError ||
        'Supabase no esta configurado. Completa .env.local antes de usar el cliente.',
    );
  }

  return {
    url: supabaseUrl,
    key: resolvedKey,
  };
}
