import { createClient } from '@supabase/supabase-js';

// Verifica el JWT del usuario contra Supabase Auth.
// Devuelve { id, email } o null si el token no sirve.
export function createSupabaseVerifier({ url, anonKey }) {
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return async function verifyToken(token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email };
  };
}