// Valores de mentira que usan juntos la config de Playwright y las pruebas.
export const E2E = {
  supabaseUrl: 'https://e2e-butaca.supabase.co',
  apiUrl: 'http://localhost:3999/api', // nadie escucha ahí: todas las llamadas se interceptan
  claveSecreta: 'clave-tmdb-que-no-debe-filtrarse',
};