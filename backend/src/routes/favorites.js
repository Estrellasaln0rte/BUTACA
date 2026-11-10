import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { createFavoriteBody, favoriteParams } from '../schemas/favorites.js';

// favoritesRepo (lo implementa Back 1 con Prisma):
//   list(userId) · add(userId, data) · remove(userId, { mediaType, tmdbId }) → true si borró algo
export function favoritesRouter({ favoritesRepo }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      res.json({ items: await favoritesRepo.list(req.user.id) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', validate({ body: createFavoriteBody }), async (req, res, next) => {
    try {
      const item = await favoritesRepo.add(req.user.id, req.body);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:mediaType/:tmdbId', validate({ params: favoriteParams }), async (req, res, next) => {
    try {
      const removed = await favoritesRepo.remove(req.user.id, req.params);
      if (!removed) return res.status(404).json({ error: 'Favorito no encontrado' });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}