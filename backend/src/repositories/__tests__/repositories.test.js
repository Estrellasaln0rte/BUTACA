import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { createRepositories } from '../index.js';

const ANA = '11111111-1111-4111-8111-111111111111';
const BETO = '22222222-2222-4222-8222-222222222222';
const UNKNOWN = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-11-10T12:00:00.000Z');
const FAVORITE = { tmdbId: 550, mediaType: 'movie', title: 'Una película', posterPath: null };
const RECOMMENDATION = { tmdbId: 550, mediaType: 'movie', emotion: 'sad', genreIds: [35, 16] };

// Doble de Prisma para probar el comportamiento de los repositorios, sin conexión.
// Simula filtros, restricciones y rollback; no sustituye pruebas en PostgreSQL.
function makePrisma(seed = {}) {
  let state = structuredClone({ profiles: [], moods: [], favorites: [], recommendations: [], ...seed });
  let pending = Promise.resolve();
  const clone = (value) => structuredClone(value);
  const error = (code) => Object.assign(new Error('Error de base simulado'), { code });

  function matches(row, where = {}) {
    return Object.entries(where).every(([key, value]) => {
      // Prisma omite undefined: una regresión del filtro podría revelar todas las filas.
      if (value === undefined) return true;
      if (key === 'createdAt') return row.createdAt >= value.gte && row.createdAt <= value.lte;
      return row[key] === value;
    });
  }

  function findMany(table) {
    return vi.fn(async ({ where, orderBy = [], take, select } = {}) => {
      const rows = state[table].filter((row) => matches(row, where));
      rows.sort((a, b) => {
        for (const order of orderBy) {
          const [key, direction] = Object.entries(order)[0];
          const difference = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
          if (difference) return direction === 'asc' ? difference : -difference;
        }
        return 0;
      });
      return clone(rows.slice(0, take).map((row) => select
        ? Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, row[key]]))
        : row));
    });
  }

  function requireProfile(userId) {
    if (!state.profiles.some((row) => row.id === userId)) throw error('P2003');
  }

  function create(table) {
    return vi.fn(async ({ data }) => {
      requireProfile(data.userId);
      if (table === 'favorites' && state.favorites.some((row) =>
        row.userId === data.userId && row.mediaType === data.mediaType && row.tmdbId === data.tmdbId)) {
        throw error('P2002');
      }
      const row = { id: randomUUID(), createdAt: new Date(NOW), ...clone(data) };
      state[table].push(row);
      return clone(row);
    });
  }

  const prisma = {
    get rows() { return clone(state); },
    profile: {
      createMany: vi.fn(async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const item of data) {
          if (![ANA, BETO].includes(item.id)) throw error('P2003');
          if (state.profiles.some((row) => row.id === item.id)) {
            if (skipDuplicates) continue;
            throw error('P2002');
          }
          state.profiles.push({ ...item, createdAt: new Date(NOW) });
          count += 1;
        }
        return { count };
      }),
      findUniqueOrThrow: vi.fn(async ({ where }) => {
        const row = state.profiles.find((item) => item.id === where.id);
        if (!row) throw error('P2025');
        return clone(row);
      }),
    },
    mood: { create: create('moods'), findMany: findMany('moods') },
    favorite: {
      create: create('favorites'),
      findMany: findMany('favorites'),
      deleteMany: vi.fn(async ({ where }) => {
        const before = state.favorites.length;
        state.favorites = state.favorites.filter((row) => !matches(row, where));
        return { count: before - state.favorites.length };
      }),
    },
    recommendation: {
      createMany: vi.fn(async ({ data }) => {
        data.forEach((row) => requireProfile(row.userId));
        state.recommendations.push(...data.map((row) => ({
          id: randomUUID(), createdAt: new Date(NOW), ...clone(row),
        })));
        return { count: data.length };
      }),
      findMany: findMany('recommendations'),
    },
    $transaction: vi.fn((callback) => {
      // Serializa este doble y revierte el conjunto si falla cualquier escritura.
      const operation = pending.then(async () => {
        const before = clone(state);
        try { return await callback(prisma); }
        catch (failure) { state = before; throw failure; }
      });
      pending = operation.catch(() => {});
      return operation;
    }),
  };
  return prisma;
}

function build(seed) {
  const prisma = makePrisma(seed);
  return { prisma, ...createRepositories({ prisma, now: () => new Date(NOW) }) };
}

describe('perfiles', () => {
  it('usa el UUID autenticado y conserva un único perfil ante llamadas simultáneas y repetidas', async () => {
    const { prisma, profilesRepo } = build();
    const profiles = await Promise.all(Array.from({ length: 8 }, () => profilesRepo.ensure(ANA)));
    expect(profiles.every((profile) => profile.id === ANA)).toBe(true);
    expect(prisma.rows.profiles).toHaveLength(1);
    expect(await profilesRepo.ensure(ANA)).toEqual(profiles[0]);
  });

  it('respeta un perfil existente sin cambiar su fecha', async () => {
    const existing = { id: ANA, createdAt: new Date('2025-01-01T00:00:00Z') };
    const { profilesRepo } = build({ profiles: [existing] });
    expect(await profilesRepo.ensure(ANA)).toEqual(existing);
  });

  it('propaga la violación de FK cuando no existe el usuario de Auth, sin dejar perfil', async () => {
    const { prisma, profilesRepo } = build();
    await expect(profilesRepo.ensure(UNKNOWN)).rejects.toMatchObject({ code: 'P2003' });
    expect(prisma.rows.profiles).toEqual([]);
  });
});

describe('emociones', () => {
  it('crea el perfil al primer registro y separa las lecturas por usuario', async () => {
    const { prisma, moodsRepo } = build();
    const created = await moodsRepo.create(ANA, { emotion: 'happy', confidence: 0.9 });
    await moodsRepo.create(BETO, { emotion: 'angry' });
    expect(created).toMatchObject({ userId: ANA, emotion: 'happy', confidence: 0.9 });
    expect(prisma.rows.profiles.map((row) => row.id)).toEqual([ANA, BETO]);
    expect(await moodsRepo.list(ANA)).toEqual([created]);
  });

  it('devuelve los últimos N ánimos propios en orden cronológico', async () => {
    const rows = [1, 2, 3].map((day) => ({
      id: String(day), userId: ANA, emotion: 'sad', createdAt: new Date(`2026-11-0${day}T00:00:00Z`),
    }));
    const { moodsRepo } = build({ moods: [...rows, { ...rows[2], id: 'beto', userId: BETO }] });
    expect((await moodsRepo.list(ANA, { limit: '2' })).map((row) => row.id)).toEqual(['2', '3']);
  });

  it('revierte también el perfil nuevo cuando falla la escritura del ánimo', async () => {
    const { prisma, moodsRepo } = build();
    const failure = new Error('Fallo simulado');
    prisma.mood.create.mockRejectedValueOnce(failure);
    await expect(moodsRepo.create(ANA, { emotion: 'sad' })).rejects.toBe(failure);
    expect(prisma.rows.profiles).toEqual([]);
    expect(prisma.rows.moods).toEqual([]);
  });

  it.each([
    { emotion: 'sad', userId: BETO },
    { emotion: 'sad', image: 'data:image/png;base64,AAAA' },
    { emotion: 'invalid' },
    { emotion: 'sad', confidence: 1.1 },
    { emotion: 'sad', confidence: -0.1 },
    { emotion: 'sad', confidence: NaN },
  ])('rechaza entradas inválidas antes de escribir: %j', async (data) => {
    const { prisma, moodsRepo } = build();
    await expect(moodsRepo.create(ANA, data)).rejects.toBeInstanceOf(ZodError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('favoritos', () => {
  it('rechaza duplicados con P2002 y permite el mismo título para otro usuario o tipo', async () => {
    const { prisma, favoritesRepo } = build();
    const first = await favoritesRepo.add(ANA, FAVORITE);
    await expect(favoritesRepo.add(ANA, FAVORITE)).rejects.toMatchObject({ code: 'P2002' });
    await favoritesRepo.add(BETO, FAVORITE);
    await favoritesRepo.add(ANA, { ...FAVORITE, mediaType: 'tv' });
    expect(prisma.rows.favorites).toHaveLength(3);
    expect((await favoritesRepo.list(BETO)).map((row) => row.userId)).toEqual([BETO]);
    expect(await favoritesRepo.list(ANA)).toContainEqual(first);
  });

  it('nadie puede borrar el favorito ajeno; el propio devuelve true y después false', async () => {
    const { favoritesRepo } = build();
    const favorite = await favoritesRepo.add(ANA, FAVORITE);
    const key = { mediaType: 'movie', tmdbId: '550' };
    expect(await favoritesRepo.remove(BETO, key)).toBe(false);
    expect(await favoritesRepo.list(ANA)).toEqual([favorite]);
    expect(await favoritesRepo.remove(ANA, key)).toBe(true);
    expect(await favoritesRepo.remove(ANA, key)).toBe(false);
  });

  it('borrar un tipo no borra otro con el mismo ID', async () => {
    const { favoritesRepo } = build();
    await favoritesRepo.add(ANA, FAVORITE);
    await favoritesRepo.add(ANA, { ...FAVORITE, mediaType: 'tv' });
    await favoritesRepo.remove(ANA, { mediaType: 'movie', tmdbId: 550 });
    expect((await favoritesRepo.list(ANA)).map((row) => row.mediaType)).toEqual(['tv']);
  });

  it('rechaza propietario inyectado, IDs fuera de PostgreSQL Int y datos inválidos', async () => {
    const { prisma, favoritesRepo } = build();
    for (const data of [
      { ...FAVORITE, userId: BETO }, { ...FAVORITE, tmdbId: 2147483648 },
      { ...FAVORITE, title: ' ' }, { ...FAVORITE, mediaType: 'anime' },
    ]) await expect(favoritesRepo.add(ANA, data)).rejects.toBeInstanceOf(ZodError);
    await expect(favoritesRepo.remove(ANA, { mediaType: 'movie', tmdbId: 550, userId: BETO }))
      .rejects.toBeInstanceOf(ZodError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.favorite.deleteMany).not.toHaveBeenCalled();
  });
});

describe('recomendaciones', () => {
  it('guarda lotes por usuario y normaliza géneros sin cambiar la entrada ni calcular recomendaciones', async () => {
    const { recommendationsRepo } = build();
    const input = [{ ...RECOMMENDATION, genreIds: [35, 35, 16] }];
    expect(await recommendationsRepo.createMany(ANA, input)).toEqual({ count: 1 });
    const [row] = await recommendationsRepo.list(ANA);
    expect(row).toMatchObject({ userId: ANA, genreIds: [35, 16], emotion: 'sad', tmdbId: 550 });
    expect(input[0].genreIds).toEqual([35, 35, 16]);
    expect(await recommendationsRepo.list(BETO)).toEqual([]);
  });

  it('conserva solicitudes repetidas como historial y limita su consulta', async () => {
    const { recommendationsRepo } = build();
    await recommendationsRepo.createMany(ANA, [RECOMMENDATION]);
    await recommendationsRepo.createMany(ANA, [RECOMMENDATION]);
    expect(await recommendationsRepo.list(ANA)).toHaveLength(2);
    expect(await recommendationsRepo.list(ANA, { limit: 1 })).toHaveLength(1);
  });

  it('un lote vacío no crea perfil ni inicia transacción', async () => {
    const { prisma, recommendationsRepo } = build();
    expect(await recommendationsRepo.createMany(ANA, [])).toEqual({ count: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('valida el lote completo antes de escribir y rechaza propietarios o campos inesperados', async () => {
    const { prisma, recommendationsRepo } = build();
    for (const invalid of [
      { ...RECOMMENDATION, userId: BETO }, { ...RECOMMENDATION, tmdbId: 0 },
      { ...RECOMMENDATION, genreIds: [2147483648] }, { ...RECOMMENDATION, image: 'AAAA' },
      { ...RECOMMENDATION, genreIds: null },
    ]) {
      await expect(recommendationsRepo.createMany(ANA, [RECOMMENDATION, invalid]))
        .rejects.toBeInstanceOf(ZodError);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.rows.profiles).toEqual([]);
    expect(prisma.rows.recommendations).toEqual([]);
  });

  it('revierte el perfil nuevo si falla la escritura del lote', async () => {
    const { prisma, recommendationsRepo } = build();
    const failure = new Error('Fallo de almacenamiento');
    prisma.recommendation.createMany.mockRejectedValueOnce(failure);
    await expect(recommendationsRepo.createMany(ANA, [RECOMMENDATION])).rejects.toBe(failure);
    expect(prisma.rows.profiles).toEqual([]);
    expect(prisma.rows.recommendations).toEqual([]);
  });
});

describe('dashboard', () => {
  it('respeta propietario, límites del período, orden temporal y conteo por tipo y género', async () => {
    const start = new Date('2026-11-03T12:00:00Z');
    const old = new Date(start.getTime() - 1);
    const future = new Date(NOW.getTime() + 1);
    const moods = [
      { id: 'start', userId: ANA, emotion: 'sad', createdAt: start },
      { id: 'end', userId: ANA, emotion: 'happy', createdAt: NOW },
      { id: 'old', userId: ANA, emotion: 'angry', createdAt: old },
      { id: 'future', userId: ANA, emotion: 'surprised', createdAt: future },
      { id: 'other', userId: BETO, emotion: 'fearful', createdAt: NOW },
    ];
    const recommendations = [
      { userId: ANA, createdAt: start, mediaType: 'movie', genreIds: [35, 35, 16] },
      { userId: ANA, createdAt: NOW, mediaType: 'movie', genreIds: [35] },
      { userId: ANA, createdAt: NOW, mediaType: 'tv', genreIds: [35] },
      ...[[ANA, old], [ANA, future], [BETO, NOW]].map(([userId, createdAt]) => ({
        userId, createdAt, mediaType: 'movie', genreIds: [999],
      })),
    ];
    const { dashboardRepo } = build({ moods, recommendations });
    expect(await dashboardRepo.summary(ANA, { days: 7 })).toEqual({
      days: 7,
      moodsOverTime: [
        { emotion: 'sad', at: start.toISOString() },
        { emotion: 'happy', at: NOW.toISOString() },
      ],
      recommendedGenres: [
        { id: 35, name: 'Comedia', mediaType: 'movie', count: 2 },
        { id: 16, name: 'Animación', mediaType: 'movie', count: 1 },
        { id: 35, name: 'Comedia', mediaType: 'tv', count: 1 },
      ],
    });
  });

  it('un usuario sin datos recibe listas vacías y no genera escrituras', async () => {
    const { prisma, dashboardRepo } = build();
    expect(await dashboardRepo.summary(ANA)).toEqual({
      days: 30, moodsOverTime: [], recommendedGenres: [],
    });
    expect(prisma.profile.createMany).not.toHaveBeenCalled();
  });

  it('conserva géneros desconocidos con una etiqueta explícita, sin inventar su nombre', async () => {
    const { dashboardRepo } = build({ recommendations: [
      { userId: ANA, createdAt: NOW, mediaType: 'movie', genreIds: [999] },
    ] });
    expect((await dashboardRepo.summary(ANA)).recommendedGenres).toEqual([
      { id: 999, name: 'Género 999', mediaType: 'movie', count: 1 },
    ]);
  });

  it.each([0, 366, 'invalid'])('rechaza days=%s antes de consultar', async (days) => {
    const { prisma, dashboardRepo } = build();
    await expect(dashboardRepo.summary(ANA, { days })).rejects.toBeInstanceOf(ZodError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('autorización defensiva en todos los métodos públicos', () => {
  const calls = [
    ['profiles.ensure', (repos, id) => repos.profilesRepo.ensure(id)],
    ['moods.create', (repos, id) => repos.moodsRepo.create(id, { emotion: 'happy' })],
    ['moods.list', (repos, id) => repos.moodsRepo.list(id)],
    ['favorites.add', (repos, id) => repos.favoritesRepo.add(id, FAVORITE)],
    ['favorites.list', (repos, id) => repos.favoritesRepo.list(id)],
    ['favorites.remove', (repos, id) => repos.favoritesRepo.remove(id, { mediaType: 'movie', tmdbId: 550 })],
    ['recommendations.createMany', (repos, id) => repos.recommendationsRepo.createMany(id, [RECOMMENDATION])],
    ['recommendations.list', (repos, id) => repos.recommendationsRepo.list(id)],
    ['dashboard.summary', (repos, id) => repos.dashboardRepo.summary(id)],
  ];

  it.each(calls)('%s rechaza UUID ausente o inválido sin consultar ni escribir', async (_name, call) => {
    const repos = build();
    for (const id of [undefined, null, '', 'user-ana', {}, `${ANA}' OR true`]) {
      await expect(call(repos, id)).rejects.toBeInstanceOf(ZodError);
    }
    expect(repos.prisma.$transaction).not.toHaveBeenCalled();
    expect(repos.prisma.mood.findMany).not.toHaveBeenCalled();
    expect(repos.prisma.favorite.findMany).not.toHaveBeenCalled();
    expect(repos.prisma.favorite.deleteMany).not.toHaveBeenCalled();
    expect(repos.prisma.recommendation.findMany).not.toHaveBeenCalled();
  });

  it('no permite límites inválidos ni queries que cambien el propietario', async () => {
    const { prisma, moodsRepo, recommendationsRepo } = build();
    for (const repo of [moodsRepo, recommendationsRepo]) {
      await expect(repo.list(ANA, { limit: 0 })).rejects.toBeInstanceOf(ZodError);
      await expect(repo.list(ANA, { limit: 201 })).rejects.toBeInstanceOf(ZodError);
      expect(await repo.list(ANA, { userId: BETO })).toEqual([]);
    }
    expect(prisma.mood.findMany.mock.calls[0][0].where.userId).toBe(ANA);
    expect(prisma.recommendation.findMany.mock.calls[0][0].where.userId).toBe(ANA);
  });
});
