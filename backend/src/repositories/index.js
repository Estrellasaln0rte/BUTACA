import { getPrismaClient } from '../lib/prisma.js';
import { createProfilesRepo } from './profiles.js';
import { createMoodsRepo } from './moods.js';
import { createFavoritesRepo } from './favorites.js';
import { createRecommendationsRepo } from './recommendations.js';
import { createDashboardRepo } from './dashboard.js';

// Todo acceso se hace con el UUID devuelto por el verificador de Supabase.
// No se verifica el JWT aquí: esa responsabilidad sigue en el middleware existente.
export function createRepositories({ prisma = getPrismaClient(), now } = {}) {
  return {
    profilesRepo: createProfilesRepo(prisma),
    moodsRepo: createMoodsRepo(prisma),
    favoritesRepo: createFavoritesRepo(prisma),
    recommendationsRepo: createRecommendationsRepo(prisma),
    dashboardRepo: createDashboardRepo(prisma, { now }),
  };
}
