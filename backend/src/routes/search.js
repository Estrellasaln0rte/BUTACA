import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { searchQuery } from '../schemas/search.js';
import { handleTmdbError } from './tmdbError.js';

// GET /api/search?query=coco&mediaType=movie&page=1
// Búsqueda por título, solo para navegar: no recibe repositorios, así que no puede
// escribir historial ni nada en la base. app.js la monta con sesión y límite por usuario.
//
// tmdb (services/tmdb.js): search(mediaType, { query, page }) → { page, totalPages, totalResults, items }
export function searchRouter({ tmdb }) {
  const router = Router();

  router.get('/', validate({ query: searchQuery }), async (req, res, next) => {
    const { query, mediaType, page } = req.validatedQuery;
    try {
      const result = await tmdb.search(mediaType, { query, page });
      res.json({ query, mediaType, ...result });
    } catch (err) {
      handleTmdbError(err, res, next);
    }
  });

  return router;
}
