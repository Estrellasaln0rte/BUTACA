import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { createMoodBody, listMoodsQuery } from '../schemas/moods.js';

// moodsRepo (lo implementa Back 1 con Prisma):
//   create(userId, { emotion, confidence }) · list(userId, { limit })
export function moodsRouter({ moodsRepo }) {
  const router = Router();

  router.post('/', validate({ body: createMoodBody }), async (req, res, next) => {
    try {
      const mood = await moodsRepo.create(req.user.id, req.body);
      res.status(201).json(mood);
    } catch (err) {
      next(err);
    }
  });

  router.get('/', validate({ query: listMoodsQuery }), async (req, res, next) => {
    try {
      res.json({ items: await moodsRepo.list(req.user.id, req.validatedQuery) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}