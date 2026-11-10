import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { dashboardQuery } from '../schemas/dashboard.js';

// dashboardRepo (lo implementa Back 1 con Prisma):
//   summary(userId, { days }) → { moodsOverTime: [...], recommendedGenres: [...] }
export function dashboardRouter({ dashboardRepo }) {
  const router = Router();

  router.get('/', validate({ query: dashboardQuery }), async (req, res, next) => {
    try {
      res.json(await dashboardRepo.summary(req.user.id, req.validatedQuery));
    } catch (err) {
      next(err);
    }
  });

  return router;
}