import { favoriteDataSchema, favoriteKeySchema, userIdSchema } from './validation.js';
import { ensureProfile } from './profiles.js';

export function createFavoritesRepo(prisma) {
  return {
    async list(userId) {
      const id = userIdSchema.parse(userId);
      return prisma.favorite.findMany({
        where: { userId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    },

    async add(userId, data) {
      const id = userIdSchema.parse(userId);
      const favorite = favoriteDataSchema.parse(data);
      return prisma.$transaction(async (tx) => {
        await ensureProfile(tx, id);
        // La restricción única decide incluso ante concurrencia.
        // P2002 se propaga al manejador existente, que responde 409.
        return tx.favorite.create({ data: { ...favorite, userId: id } });
      });
    },

    async remove(userId, key) {
      const id = userIdSchema.parse(userId);
      const { mediaType, tmdbId } = favoriteKeySchema.parse(key);
      // Comprobar y borrar es una única operación, siempre limitada al propietario.
      const { count } = await prisma.favorite.deleteMany({
        where: { userId: id, mediaType, tmdbId },
      });
      return count > 0;
    },
  };
}
