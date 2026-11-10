import { dashboardQuery } from '../schemas/dashboard.js';
import { MOVIE_GENRES, TV_GENRES } from '../services/moodToGenres.js';
import { userIdSchema } from './validation.js';

const genreNames = {
  movie: new Map(Object.values(MOVIE_GENRES).map(({ id, name }) => [id, name])),
  tv: new Map(Object.values(TV_GENRES).map(({ id, name }) => [id, name])),
};

export function createDashboardRepo(prisma, { now = () => new Date() } = {}) {
  return {
    async summary(userId, options = {}) {
      const id = userIdSchema.parse(userId);
      const { days } = dashboardQuery.parse(options);
      const end = now();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      const where = { userId: id, createdAt: { gte: start, lte: end } };

      return prisma.$transaction(async (tx) => {
        const moods = await tx.mood.findMany({
          where,
          select: { emotion: true, createdAt: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        const recommendations = await tx.recommendation.findMany({
          where,
          select: { mediaType: true, genreIds: true },
        });

        const counts = new Map();
        for (const { mediaType, genreIds } of recommendations) {
          for (const genreId of new Set(genreIds)) {
            const key = `${mediaType}:${genreId}`;
            const entry = counts.get(key) ?? {
              id: genreId,
              name: genreNames[mediaType]?.get(genreId) ?? `Género ${genreId}`,
              mediaType,
              count: 0,
            };
            entry.count += 1;
            counts.set(key, entry);
          }
        }

        return {
          days,
          moodsOverTime: moods.map(({ emotion, createdAt }) => ({
            emotion, at: createdAt.toISOString(),
          })),
          recommendedGenres: [...counts.values()].sort((a, b) =>
            b.count - a.count || a.mediaType.localeCompare(b.mediaType) || a.id - b.id),
        };
      }, { isolationLevel: 'RepeatableRead' });
    },
  };
}
