import rateLimit from 'express-rate-limit';

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo en un momento' },
};

// Límite general para toda la API, por IP (corre antes de saber quién es el usuario).
export const generalLimiter = (opts = {}) =>
  rateLimit({ ...base, windowMs: 60_000, limit: 100, ...opts });

// Más estricto para rutas que gastan cuota externa (TMDB): recomendaciones y búsqueda.
// Cuenta POR USUARIO, no por IP: va después de requireAuth, así que req.user ya existe.
// Por IP, todos los que comparten red (por ejemplo, el wifi de la universidad en la demo)
// compartirían el mismo cupo. Cada llamada crea su propio contador.
export const strictLimiter = (opts = {}) =>
  rateLimit({
    ...base,
    windowMs: 60_000,
    limit: 20,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`),
    ...opts,
  });
