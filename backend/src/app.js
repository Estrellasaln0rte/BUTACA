import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

// Arma la app de Express sin levantar el servidor (así se puede testear con supertest).
// Aquí el equipo de back registra rutas, rate limit y el manejador de errores.
export function createApp({ frontendUrl } = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: frontendUrl }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // TODO(back): app.use('/api', routes);
  // TODO(back): rate limit, middleware de auth, manejador de errores.

  return app;
}
