import { env } from './config/env.js';
import { createApp } from './app.js';
import { createSupabaseVerifier } from './lib/supabase.js';

const app = createApp({
  frontendUrl: env.FRONTEND_URL,
  nodeEnv: env.NODE_ENV,
  verifyToken: createSupabaseVerifier({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY }),
  // TODO(back): cuando existan, pasar aquí:
  //   repos: { favoritesRepo, moodsRepo, dashboardRepo }   ← Back 1 (Prisma)
  //   recommendationsRouter                                ← Back 2 (TMDB)
});

app.listen(env.PORT, () => {
  console.log(`Butaca API escuchando en http://localhost:${env.PORT}`);
});