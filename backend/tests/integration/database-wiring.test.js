import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createSupabaseVerifier } from '../../src/lib/supabase.js';
import { createRepositories } from '../../src/repositories/index.js';
import { recommendationsRouter } from '../../src/routes/recommendations.js';
import { TmdbError } from '../../src/services/tmdb.js';

const ANA = '11111111-1111-4111-8111-111111111111';
const BETO = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-11-10T12:00:00Z');
// Sesiones y clave ficticias: nunca se utiliza la configuración real.
const ana = { Authorization: 'Bearer test-session-ana' };
const beto = { Authorization: 'Bearer test-session-beto' };
const ITEM = {
  tmdbId: 550, mediaType: 'movie', title: 'Película de prueba',
  overview: 'Sinopsis', posterPath: null, releaseDate: '2000-01-01', rating: 8,
};
const RESULT = { page: 1, totalPages: 1, totalResults: 1, items: [ITEM] };

function makePrisma() {
  const rows = { profiles: [], moods: [], favorites: [], recommendations: [] };
  let nextId = 0;
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'createdAt') return row.createdAt >= value.gte && row.createdAt <= value.lte;
    return row[key] === value;
  });
  const findMany = (table) => vi.fn(async ({ where, take, select } = {}) =>
    rows[table].filter((row) => matches(row, where)).slice(0, take).map((row) => select
      ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]))
      : { ...row }));
  const create = (table) => vi.fn(async ({ data }) => {
    if (table === 'favorites' && rows.favorites.some((row) =>
      row.userId === data.userId && row.tmdbId === data.tmdbId && row.mediaType === data.mediaType)) {
      throw Object.assign(new Error('Duplicado simulado'), { code: 'P2002' });
    }
    const row = { id: String(++nextId), createdAt: new Date(NOW), ...data };
    rows[table].push(row);
    return row;
  });
  const prisma = {
    rows,
    profile: {
      createMany: vi.fn(async ({ data }) => {
        const fresh = data.filter(({ id }) => !rows.profiles.some((row) => row.id === id));
        rows.profiles.push(...fresh.map((row) => ({ ...row, createdAt: new Date(NOW) })));
        return { count: fresh.length };
      }),
      findUniqueOrThrow: vi.fn(async ({ where }) => rows.profiles.find((row) => row.id === where.id)),
    },
    mood: { create: create('moods'), findMany: findMany('moods') },
    favorite: {
      create: create('favorites'), findMany: findMany('favorites'),
      deleteMany: vi.fn(async ({ where }) => {
        const before = rows.favorites.length;
        rows.favorites = rows.favorites.filter((row) => !matches(row, where));
        return { count: before - rows.favorites.length };
      }),
    },
    recommendation: {
      createMany: vi.fn(async ({ data }) => {
        rows.recommendations.push(...data.map((row) => ({
          id: String(++nextId), createdAt: new Date(NOW), ...row,
        })));
        return { count: data.length };
      }),
      findMany: findMany('recommendations'),
    },
    $transaction: vi.fn(async (callback) => callback(prisma)),
  };
  return prisma;
}

function build(result = RESULT) {
  // Se usa el SDK real con transporte simulado: cualquier petición inesperada falla.
  const authFetch = vi.fn(async (input, options) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://auth.butaca.test' || url.pathname !== '/auth/v1/user') {
      throw new Error('Petición inesperada en el transporte de prueba');
    }
    const token = new Headers(options.headers).get('authorization');
    const id = token === ana.Authorization ? ANA : token === beto.Authorization ? BETO : null;
    return new Response(JSON.stringify(id ? {
      id, email: 'usuario@example.test', aud: 'authenticated',
      // Ni el repositorio ni la ruta deben usar metadatos como propietario.
      user_metadata: { userId: id === ANA ? BETO : ANA },
    } : { code: 'bad_jwt', message: 'Sesión rechazada en la prueba' }), {
      status: id ? 200 : 401, headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', authFetch);
  const prisma = makePrisma();
  const repos = createRepositories({ prisma, now: () => new Date(NOW) });
  const tmdb = { discover: vi.fn(async () => structuredClone(result)) };
  const app = createApp({
    frontendUrl: 'http://localhost:5173',
    verifyToken: createSupabaseVerifier({ url: 'https://auth.butaca.test', anonKey: 'test-public-key' }),
    repos,
    recommendationsRouter: recommendationsRouter({ tmdb, recommendationsRepo: repos.recommendationsRepo }),
  });
  return { app, prisma, tmdb, authFetch };
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('autenticación de Supabase antes de acceder a datos', () => {
  const privateRoutes = [
    ['get', '/api/favorites'], ['post', '/api/favorites'],
    ['delete', '/api/favorites/movie/550'], ['get', '/api/moods'],
    ['post', '/api/moods'], ['get', '/api/dashboard'],
    ['get', '/api/recommendations?emotion=sad'],
  ];

  it.each(privateRoutes)('%s %s rechaza sesiones ausentes, inválidas o vencidas sin consultar Prisma', async (method, path) => {
    const { app, prisma, tmdb, authFetch } = build();
    expect((await request(app)[method](path)).status).toBe(401);
    expect(authFetch).not.toHaveBeenCalled();
    for (const session of ['test-invalid-session', 'test-expired-session']) {
      expect((await request(app)[method](path).set('Authorization', `Bearer ${session}`)).status).toBe(401);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.favorite.findMany).not.toHaveBeenCalled();
    expect(prisma.favorite.deleteMany).not.toHaveBeenCalled();
    expect(prisma.mood.findMany).not.toHaveBeenCalled();
    expect(prisma.recommendation.findMany).not.toHaveBeenCalled();
    expect(tmdb.discover).not.toHaveBeenCalled();
  });

  it('rechaza un JWT fabricado con sub válido cuando Supabase lo rechaza', async () => {
    const { app, prisma } = build();
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const forged = `${encode({ alg: 'none' })}.${encode({ sub: ANA })}.invalid`;
    const response = await request(app).post('/api/moods')
      .set('Authorization', `Bearer ${forged}`).send({ emotion: 'happy' });
    expect(response.status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('HTTP y repositorios conectados', () => {
  it('guarda con el UUID verificado, ignora userId de la query y conserva el JSON de recomendaciones', async () => {
    const { app, prisma, tmdb, authFetch } = build();
    const response = await request(app)
      .get(`/api/recommendations?emotion=sad&userId=${BETO}&genreIds=999`).set(ana);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      emotion: 'sad', mediaType: 'movie', genres: [
        { id: 35, name: 'Comedia' }, { id: 16, name: 'Animación' }, { id: 10751, name: 'Familia' },
      ], ...RESULT,
    });
    expect(tmdb.discover).toHaveBeenCalledWith('movie', { genreIds: [35, 16, 10751], page: 1 });
    expect(prisma.rows.profiles.map(({ id }) => id)).toEqual([ANA]);
    expect(prisma.rows.recommendations).toHaveLength(1);
    expect(prisma.rows.recommendations[0]).toMatchObject({
      userId: ANA, emotion: 'sad', mediaType: 'movie', tmdbId: 550, genreIds: [35, 16, 10751],
    });
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  it('conserva tipo y página de TMDB y persiste todos los títulos de series', async () => {
    const result = { ...RESULT, page: 3, totalPages: 3, totalResults: 2, items: [
      { ...ITEM, mediaType: 'tv' }, { ...ITEM, tmdbId: 551, mediaType: 'tv' },
    ] };
    const { app, prisma, tmdb } = build(result);
    const response = await request(app)
      .get('/api/recommendations?emotion=angry&mediaType=tv&page=3').set(beto);
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(result.items);
    expect(tmdb.discover).toHaveBeenCalledWith('tv', { genreIds: [10759, 80], page: 3 });
    expect(prisma.rows.recommendations.map(({ userId, mediaType, tmdbId, genreIds }) => ({
      userId, mediaType, tmdbId, genreIds,
    }))).toEqual([550, 551].map((tmdbId) => ({
      userId: BETO, mediaType: 'tv', tmdbId, genreIds: [10759, 80],
    })));
  });

  it('emociones, favoritos y dashboard solo acceden a los datos de la sesión', async () => {
    const { app, prisma } = build();
    const favorite = { tmdbId: 550, mediaType: 'movie', title: ITEM.title };
    expect((await request(app).post('/api/moods').set(ana).send({ emotion: 'happy' })).status).toBe(201);
    expect((await request(app).post('/api/favorites').set(ana).send(favorite)).status).toBe(201);
    expect((await request(app).get('/api/recommendations?emotion=sad').set(ana)).status).toBe(200);

    expect((await request(app).get(`/api/moods?userId=${ANA}`).set(beto)).body).toEqual({ items: [] });
    expect((await request(app).get(`/api/favorites?userId=${ANA}`).set(beto)).body).toEqual({ items: [] });
    expect((await request(app).get(`/api/dashboard?days=7&userId=${ANA}`).set(beto)).body)
      .toEqual({ days: 7, moodsOverTime: [], recommendedGenres: [] });
    expect((await request(app).delete(`/api/favorites/movie/550?userId=${ANA}`).set(beto)).status).toBe(404);
    expect(prisma.rows.favorites).toHaveLength(1);

    const own = await request(app).get(`/api/dashboard?days=7&userId=${BETO}`).set(ana);
    expect(own.status).toBe(200);
    expect(own.body).toEqual({
      days: 7, moodsOverTime: [{ emotion: 'happy', at: NOW.toISOString() }],
      recommendedGenres: [
        { id: 16, name: 'Animación', mediaType: 'movie', count: 1 },
        { id: 35, name: 'Comedia', mediaType: 'movie', count: 1 },
        { id: 10751, name: 'Familia', mediaType: 'movie', count: 1 },
      ],
    });
    expect((await request(app).post('/api/favorites').set(ana).send(favorite)).status).toBe(409);
    expect((await request(app).delete('/api/favorites/movie/550').set(ana)).status).toBe(204);
  });

  it.each([
    ['/api/moods', { emotion: 'happy', userId: BETO }],
    ['/api/favorites', { tmdbId: 550, mediaType: 'movie', title: ITEM.title, userId: BETO }],
  ])('%s rechaza propietarios dentro del body antes de escribir', async (path, body) => {
    const { app, prisma } = build();
    expect((await request(app).post(path).set(ana).send(body)).status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('una respuesta vacía de TMDB conserva HTTP 200 sin crear perfil ni historial', async () => {
    const result = { page: 1, totalPages: 0, totalResults: 0, items: [] };
    const { app, prisma } = build(result);
    const response = await request(app).get('/api/recommendations?emotion=sad').set(ana);
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.rows.profiles).toEqual([]);
  });

  it('datos inválidos no consultan TMDB ni persisten recomendaciones', async () => {
    const { app, prisma, tmdb } = build();
    const response = await request(app).get('/api/recommendations?emotion=invalid').set(ana);
    expect(response.status).toBe(400);
    expect(tmdb.discover).not.toHaveBeenCalled();
    expect(prisma.recommendation.createMany).not.toHaveBeenCalled();
  });

  it('un fallo de TMDB mantiene el 502 y no escribe historial', async () => {
    const { app, prisma, tmdb } = build();
    tmdb.discover.mockRejectedValueOnce(new TmdbError('Fallo simulado', { upstreamStatus: 503 }));
    const response = await request(app).get('/api/recommendations?emotion=sad').set(ana);
    expect(response.status).toBe(502);
    expect(prisma.recommendation.createMany).not.toHaveBeenCalled();
  });

  it('espera la persistencia y devuelve el 500 genérico si falla, sin filtrar detalles', async () => {
    const { app, prisma } = build();
    prisma.recommendation.createMany.mockRejectedValueOnce(new Error('Detalle interno simulado'));
    const response = await request(app).get('/api/recommendations?emotion=sad').set(ana);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Error interno del servidor' });
  });
});
