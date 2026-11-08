// Dobles de prueba: repos en memoria y verificador de token falso.
// Sirven para probar las rutas sin Supabase ni base de datos.
export const USERS = {
  'token-ana': { id: 'user-ana', email: 'ana@test.com' },
  'token-beto': { id: 'user-beto', email: 'beto@test.com' },
};

export const fakeVerifyToken = async (token) => USERS[token] ?? null;

export function makeFakeRepos() {
  const favorites = [];
  const moods = [];

  return {
    favoritesRepo: {
      async list(userId) {
        return favorites.filter((f) => f.userId === userId);
      },
      async add(userId, data) {
        const row = { id: favorites.length + 1, userId, ...data };
        favorites.push(row);
        return row;
      },
      async remove(userId, { mediaType, tmdbId }) {
        const i = favorites.findIndex(
          (f) => f.userId === userId && f.mediaType === mediaType && f.tmdbId === tmdbId,
        );
        if (i === -1) return false;
        favorites.splice(i, 1);
        return true;
      },
    },
    moodsRepo: {
      async create(userId, data) {
        const row = { id: moods.length + 1, userId, createdAt: new Date().toISOString(), ...data };
        moods.push(row);
        return row;
      },
      async list(userId, { limit }) {
        return moods.filter((m) => m.userId === userId).slice(-limit);
      },
    },
    dashboardRepo: {
      async summary(userId, { days }) {
        const mine = moods.filter((m) => m.userId === userId);
        return { days, moodsOverTime: mine.map((m) => ({ emotion: m.emotion, at: m.createdAt })), recommendedGenres: [] };
      },
    },
  };
}