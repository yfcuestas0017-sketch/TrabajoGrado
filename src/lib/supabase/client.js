import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig, hasSupabaseConfig } from './config';

let browserClient = null;

export function getSupabaseClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, key } = getSupabaseConfig();

  browserClient = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

export const supabase = hasSupabaseConfig ? getSupabaseClient() : null;
