import { TmdbError } from '../services/tmdb.js';

// Respuesta común de las rutas que llaman a TMDB (recomendaciones y búsqueda).
// Un fallo de TMDB → 502 con mensaje genérico; el detalle queda solo en el log del servidor.
// Cualquier otro error → errorHandler (500).
export function handleTmdbError(err, res, next) {
  if (err instanceof TmdbError) {
    console.error(`[tmdb] ${err.message}`, err.upstreamStatus ?? '');
    return res.status(502).json({ error: 'El servicio de películas no está disponible, intenta de nuevo en un momento' });
  }
  return next(err);
}
