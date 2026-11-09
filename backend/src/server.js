import { env } from './config/env.js';
import { createApp } from './app.js';
import { createSupabaseVerifier } from './lib/supabase.js';
import { createTmdbClient } from './services/tmdb.js';
import { recommendationsRouter } from './routes/recommendations.js';

const app = createApp({
  frontendUrl: env.FRONTEND_URL,
  nodeEnv: env.NODE_ENV,
  verifyToken: createSupabaseVerifier({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY }),
  recommendationsRouter: recommendationsRouter({
    tmdb: createTmdbClient({ apiKey: env.TMDB_API_KEY }),
  }),
  // TODO(back): cuando existan, pasar aquí:
  //   repos: { favoritesRepo, moodsRepo, dashboardRepo }   ← Back 1 (Prisma)
});

app.listen(env.PORT, () => {
  console.log(`Butaca API escuchando en http://localhost:${env.PORT}`);
});