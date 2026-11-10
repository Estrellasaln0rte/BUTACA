import { env } from './config/env.js';
import { createApp } from './app.js';
import { createSupabaseVerifier } from './lib/supabase.js';
import { disconnectPrisma } from './lib/prisma.js';
import { registerShutdown } from './lib/shutdown.js';
import { createTmdbClient } from './services/tmdb.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { searchRouter } from './routes/search.js';
import { createRepositories } from './repositories/index.js';

const repos = createRepositories();
const tmdb = createTmdbClient({ apiKey: env.TMDB_API_KEY });

const app = createApp({
  frontendUrl: env.FRONTEND_URL,
  nodeEnv: env.NODE_ENV,
  verifyToken: createSupabaseVerifier({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY }),
  repos,
  recommendationsRouter: recommendationsRouter({ tmdb, recommendationsRepo: repos.recommendationsRepo }),
  // Sin repositorios a propósito: la búsqueda es solo navegación y no escribe en la base.
  searchRouter: searchRouter({ tmdb }),
});

const server = app.listen(env.PORT, () => {
  console.log(`Butaca API escuchando en http://localhost:${env.PORT}`);
});

// Al detener o redesplegar (SIGTERM/SIGINT): termina las solicitudes en curso y cierra Prisma.
registerShutdown({ server, cleanup: disconnectPrisma });
