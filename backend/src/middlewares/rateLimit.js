import rateLimit from 'express-rate-limit';

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo en un momento' },
};

// Límite general para toda la API.
export const generalLimiter = (opts = {}) =>
  rateLimit({ ...base, windowMs: 60_000, limit: 100, ...opts });

// Más estricto para rutas que gastan cuota externa (TMDB): /api/recommendations.
export const strictLimiter = (opts = {}) =>
  rateLimit({ ...base, windowMs: 60_000, limit: 20, ...opts });