import { env } from './config/env.js';
import { createApp } from './app.js';
import { createSupabaseVerifier } from './lib/supabase.js';
import { createTmdbClient } from './services/tmdb.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { createRepositories } from './repositories/index.js';

const repos = createRepositories();

const app = createApp({
  frontendUrl: env.FRONTEND_URL,
  nodeEnv: env.NODE_ENV,
  verifyToken: createSupabaseVerifier({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY }),
  repos,
  recommendationsRouter: recommendationsRouter({
    tmdb: createTmdbClient({ apiKey: env.TMDB_API_KEY }),
    recommendationsRepo: repos.recommendationsRepo,
  }),
});

app.listen(env.PORT, () => {
  console.log(`Butaca API escuchando en http://localhost:${env.PORT}`);
});
