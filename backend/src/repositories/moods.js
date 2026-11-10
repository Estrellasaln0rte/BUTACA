import { createMoodBody, listMoodsQuery } from '../schemas/moods.js';
import { userIdSchema } from './validation.js';
import { ensureProfile } from './profiles.js';

export function createMoodsRepo(prisma) {
  return {
    async create(userId, data) {
      const id = userIdSchema.parse(userId);
      const mood = createMoodBody.parse(data);
      return prisma.$transaction(async (tx) => {
        await ensureProfile(tx, id);
        return tx.mood.create({ data: { ...mood, userId: id } });
      });
    },

    async list(userId, options = {}) {
      const id = userIdSchema.parse(userId);
      const { limit } = listMoodsQuery.parse(options);
      const rows = await prisma.mood.findMany({
        where: { userId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });
      // Los últimos N registros en orden cronológico, como el contrato existente.
      return rows.reverse();
    },
  };
}
