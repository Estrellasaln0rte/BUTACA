import { userIdSchema } from './validation.js';

// INSERT ... ON CONFLICT DO NOTHING: conserva el perfil ante solicitudes concurrentes.
// Solo recibe un UUID ya validado; se llama dentro de una transacción.
export async function ensureProfile(tx, userId) {
  await tx.profile.createMany({ data: [{ id: userId }], skipDuplicates: true });
  return tx.profile.findUniqueOrThrow({ where: { id: userId } });
}

export function createProfilesRepo(prisma) {
  return {
    async ensure(userId) {
      const id = userIdSchema.parse(userId);
      return prisma.$transaction((tx) => ensureProfile(tx, id));
    },
  };
}
