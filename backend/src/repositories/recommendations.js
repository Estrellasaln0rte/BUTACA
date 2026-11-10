import { listMoodsQuery } from '../schemas/moods.js';
import { recommendationBatchSchema, userIdSchema } from './validation.js';
import { ensureProfile } from './profiles.js';

export function createRecommendationsRepo(prisma) {
  return {
    // Contrato interno, sin ruta nueva: un registro por título recomendado.
    // Cada registro contiene { emotion, mediaType, tmdbId, genreIds }.
    async createMany(userId, records) {
      const id = userIdSchema.parse(userId);
      const items = recommendationBatchSchema.parse(records);
      if (items.length === 0) return { count: 0 };

      const data = items.map((item) => ({
        ...item,
        genreIds: [...new Set(item.genreIds)],
        userId: id,
      }));
      return prisma.$transaction(async (tx) => {
        await ensureProfile(tx, id);
        // Repeticiones en distintas solicitudes son parte del historial.
        return tx.recommendation.createMany({ data });
      });
    },

    async list(userId, options = {}) {
      const id = userIdSchema.parse(userId);
      const { limit } = listMoodsQuery.parse(options);
      return prisma.recommendation.findMany({
        where: { userId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });
    },
  };
}
