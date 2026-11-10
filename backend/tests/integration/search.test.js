import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { searchRouter } from '../../src/routes/search.js';
import { recommendationsRouter } from '../../src/routes/recommendations.js';
import { TmdbError } from '../../src/services/tmdb.js';
import { fakeVerifyToken, makeFakeRepos } from '../helpers/fakes.js';

const ana = { Authorization: 'Bearer token-ana' };
const RESULT = {
  page: 1,
  totalPages: 1,
  totalResults: 1,
  items: [{ tmdbId: 354912, mediaType: 'movie', title: 'Coco', overview: '', posterPath: '/coco.jpg', releaseDate: '2017-10-27', rating: 8.2 }],
};

function build({ impl = async () => structuredClone(RESULT), limits } = {}) {
  const tmdb = { discover: vi.fn(async () => structuredClone(RESULT)), search: vi.fn(impl) };
  const repos = makeFakeRepos();
  const recommendationsRepo = { createMany: vi.fn(async () => ({ count: 1 })) };
  const app = createApp({
    frontendUrl: 'http://localhost:5173',
    verifyToken: fakeVerifyToken,
    repos,
    recommendationsRouter: recommendationsRouter({ tmdb, recommendationsRepo }),
    searchRouter: searchRouter({ tmdb }),
    limits,
  });
  return { app, tmdb, repos, recommendationsRepo };
}

describe('GET /api/search', () => {
  let consoleError;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it('responde 401 sin token y no llama a TMDB', async () => {
    const { app, tmdb } = build();
    expect((await request(app).get('/api/search?query=coco')).status).toBe(401);
    expect(tmdb.search).not.toHaveBeenCalled();
  });

  it('busca por título y devuelve la misma forma de items que las recomendaciones', async () => {
    const { app, tmdb } = build();
    const res = await request(app).get('/api/search?query=%20coco%20&mediaType=movie&page=1').set(ana);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ query: 'coco', mediaType: 'movie', ...RESULT });
    expect(tmdb.search).toHaveBeenCalledWith('movie', { query: 'coco', page: 1 });
  });

  it('busca series cuando se pide mediaType=tv', async () => {
    const { app, tmdb } = build();
    await request(app).get('/api/search?query=dark&mediaType=tv&page=2').set(ana);
    expect(tmdb.search).toHaveBeenCalledWith('tv', { query: 'dark', page: 2 });
  });

  it('nunca escribe historial ni nada en la base', async () => {
    const { app, recommendationsRepo, repos } = build();
    const spies = [
      recommendationsRepo.createMany,
      vi.spyOn(repos.moodsRepo, 'create'),
      vi.spyOn(repos.favoritesRepo, 'add'),
    ];
    expect((await request(app).get('/api/search?query=coco').set(ana)).status).toBe(200);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ['sin texto', '/api/search', 'query'],
    ['solo espacios', '/api/search?query=%20%20', 'query'],
    ['tipo inválido', '/api/search?query=coco&mediaType=person', 'mediaType'],
    ['página fuera de rango', '/api/search?query=coco&page=501', 'page'],
  ])('responde 400 %s y no llama a TMDB', async (_caso, url, campo) => {
    const { app, tmdb } = build();
    const res = await request(app).get(url).set(ana);
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty(campo);
    expect(tmdb.search).not.toHaveBeenCalled();
  });

  it('responde 502 si TMDB falla, sin exponer detalles', async () => {
    const { app } = build({
      impl: async () => {
        throw new TmdbError('TMDB respondió 401', { upstreamStatus: 401 });
      },
    });
    const res = await request(app).get('/api/search?query=coco').set(ana);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: expect.stringContaining('no está disponible') });
    expect(consoleError).toHaveBeenCalled();
  });

  it('tiene su propio límite: buscar no gasta el cupo de recomendaciones', async () => {
    const { app } = build({ limits: { search: { limit: 2 }, strict: { limit: 2 } } });
    const busquedas = [];
    for (let i = 0; i < 3; i++) busquedas.push((await request(app).get('/api/search?query=coco').set(ana)).status);
    expect(busquedas).toEqual([200, 200, 429]);

    // Agotó la búsqueda, pero las recomendaciones siguen con su cupo completo.
    expect((await request(app).get('/api/recommendations?emotion=sad').set(ana)).status).toBe(200);
  });
});
