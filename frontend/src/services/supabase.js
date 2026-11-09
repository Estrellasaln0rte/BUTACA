import { createClient } from '@supabase/supabase-js';

// Cliente público de Supabase (solo la anon key, nunca secretos).
// Lo comparten el login (Front 1) y las llamadas al backend (Front 2).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
