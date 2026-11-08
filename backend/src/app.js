import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { generalLimiter, strictLimiter } from './middlewares/rateLimit.js';
import { createRequireAuth } from './middlewares/auth.js';
import { enforceHttps } from './middlewares/enforceHttps.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import { favoritesRouter } from './routes/favorites.js';
import { moodsRouter } from './routes/moods.js';
import { dashboardRouter } from './routes/dashboard.js';

// Arma la app de Express sin levantar el servidor (así se puede testear con supertest).
// Todo lo externo entra por parámetro (inyección de dependencias):
//   verifyToken  → verifica el JWT de Supabase (Back 3)
//   repos        → acceso a datos con Prisma (Back 1)
//   recommendationsRouter → router de TMDB (Back 2); se monta protegido y con límite estricto
export function createApp({
  frontendUrl,
  nodeEnv = 'development',
  verifyToken = async () => null, // sin verificador, TODO queda protegido (401)
  repos = {},
  recommendationsRouter,
  limits = {},
} = {}) {
  const app = express();

  if (nodeEnv === 'production') {
    app.set('trust proxy', 1); // detrás de un proxy (Render, Railway...) para IP real y req.secure
    app.use(enforceHttps);
  }

  app.use(helmet());
  // El header Origin nunca trae "/" final: normalizamos para no romper CORS por un detalle del .env.
  // Si no hay URL configurada, no se permite ningún origen (nunca "*").
  const allowedOrigin = frontendUrl ? frontendUrl.replace(/\/+$/, '') : false;
  app.use(
    cors({
      origin: allowedOrigin,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '10kb' })); // una emoción pesa bytes; nada de imágenes
  app.use('/api', generalLimiter(limits.general));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const requireAuth = createRequireAuth(verifyToken);

  if (recommendationsRouter) {
    app.use('/api/recommendations', requireAuth, strictLimiter(limits.strict), recommendationsRouter);
  }
  if (repos.favoritesRepo) {
    app.use('/api/favorites', requireAuth, favoritesRouter(repos));
  }
  if (repos.moodsRepo) {
    app.use('/api/moods', requireAuth, moodsRouter(repos));
  }
  if (repos.dashboardRepo) {
    app.use('/api/dashboard', requireAuth, dashboardRouter(repos));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}