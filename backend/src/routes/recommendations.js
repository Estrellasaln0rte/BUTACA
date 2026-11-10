import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { recommendationsQuery } from '../schemas/recommendations.js';
import { genresForEmotion } from '../services/moodToGenres.js';
import { TmdbError } from '../services/tmdb.js';

// GET /api/recommendations?emotion=sad&mediaType=movie&page=1
// app.js ya lo monta detrás de requireAuth y del límite estricto (20/min).
//
// tmdb (services/tmdb.js): discover(mediaType, { genreIds, page }) → { page, totalPages, totalResults, items }
// recommendationsRepo (repositories/recommendations.js, opcional): createMany(userId, registros)
// Ambos se inyectan para poder probar la ruta con dobles.
export function recommendationsRouter({ tmdb, recommendationsRepo }) {
  const router = Router();

  router.get('/', validate({ query: recommendationsQuery }), async (req, res, next) => {
    const { emotion, mediaType, page } = req.validatedQuery;
    const genres = genresForEmotion(emotion, mediaType);
    const genreIds = genres.map((g) => g.id);

    let result;
    try {
      result = await tmdb.discover(mediaType, { genreIds, page });
    } catch (err) {
      if (err instanceof TmdbError) {
        // Queda en el log del servidor; al cliente solo le llega un mensaje genérico.
        console.error(`[tmdb] ${err.message}`, err.upstreamStatus ?? '');
        return res.status(502).json({ error: 'El servicio de películas no está disponible, intenta de nuevo en un momento' });
      }
      return next(err); // cualquier otro error → 500 en errorHandler
    }

    // El historial (lo usa el dashboard) es secundario: si no se puede guardar, se registra
    // en el log y el usuario recibe igual sus recomendaciones, que ya se obtuvieron.
    if (recommendationsRepo) {
      try {
        await recommendationsRepo.createMany(
          req.user.id,
          result.items.map(({ tmdbId }) => ({ emotion, mediaType, tmdbId, genreIds })),
        );
      } catch (err) {
        console.error('[historial] no se pudo guardar el historial de recomendaciones:', err?.code ?? err?.message ?? err);
      }
    }

    res.json({ emotion, mediaType, genres, ...result });
  });

  return router;
}
