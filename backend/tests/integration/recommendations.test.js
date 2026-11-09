import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { recommendationsRouter } from '../../src/routes/recommendations.js';
import { TmdbError } from '../../src/services/tmdb.js';
import { fakeVerifyToken } from '../helpers/fakes.js';

const ana = { Authorization: 'Bearer token-ana' };

const ITEM = {
  tmdbId: 354912,
  mediaType: 'movie',
  title: 'Coco',
  overview: 'Miguel sueña con ser músico...',
  posterPath: '/coco.jpg',
  releaseDate: '2017-10-27',
  rating: 8.2,
};

// TMDB falso: discover es un espía de vitest, así se puede ver con qué se llamó.
function makeFakeTmdb(impl = async () => ({ page: 1, totalPages: 7, totalResults: 140, items: [ITEM] })) {
  return { discover: vi.fn(impl) };
}

const build = (tmdb) =>
  createApp({
    frontendUrl: 'http://localhost:5173',
    verifyToken: fakeVerifyToken,
    recommendationsRouter: recommendationsRouter({ tmdb }),
  });

describe('GET /api/recommendations', () => {
  let consoleError;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}); // sin ruido en la salida
  });
  afterEach(() => consoleError.mockRestore());

  it('responde 401 sin token y no llama a TMDB', async () => {
    const tmdb = makeFakeTmdb();
    const res = await request(build(tmdb)).get('/api/recommendations?emotion=sad');
    expect(res.status).toBe(401);
    expect(tmdb.discover).not.toHaveBeenCalled();
  });

  it('devuelve recomendaciones con los géneros de la emoción', async () => {
    const tmdb = makeFakeTmdb();
    const res = await request(build(tmdb)).get('/api/recommendations?emotion=sad').set(ana);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      emotion: 'sad',
      mediaType: 'movie',
      genres: [
        { id: 35, name: 'Comedia' },
        { id: 16, name: 'Animación' },
        { id: 10751, name: 'Familia' },
      ],
      page: 1,
      totalPages: 7,
      totalResults: 140,
      items: [ITEM],
    });
    expect(tmdb.discover).toHaveBeenCalledWith('movie', { genreIds: [35, 16, 10751], page: 1 });
  });

  it('pasa a TMDB el tipo y la página pedidos', async () => {
    const tmdb = makeFakeTmdb();
    const res = await request(build(tmdb)).get('/api/recommendations?emotion=angry&mediaType=tv&page=3').set(ana);

    expect(res.status).toBe(200);
    expect(res.body.mediaType).toBe('tv');
    expect(tmdb.discover).toHaveBeenCalledWith('tv', { genreIds: [10759, 80], page: 3 });
  });

  it.each([
    ['sin emoción', '/api/recommendations', 'emotion'],
    ['emoción desconocida', '/api/recommendations?emotion=aburrido', 'emotion'],
    ['tipo inválido', '/api/recommendations?emotion=sad&mediaType=anime', 'mediaType'],
    ['página fuera de rango', '/api/recommendations?emotion=sad&page=0', 'page'],
  ])('responde 400 con %s y no llama a TMDB', async (_caso, url, campo) => {
    const tmdb = makeFakeTmdb();
    const res = await request(build(tmdb)).get(url).set(ana);

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty(campo);
    expect(tmdb.discover).not.toHaveBeenCalled();
  });

  it.each([
    ['TMDB responde con error', new TmdbError('TMDB respondió 401', { upstreamStatus: 401 })],
    ['TMDB no responde a tiempo', new TmdbError('TMDB no respondió a tiempo')],
  ])('responde 502 si %s, sin exponer detalles internos', async (_caso, error) => {
    const tmdb = makeFakeTmdb(async () => {
      throw error;
    });
    const res = await request(build(tmdb)).get('/api/recommendations?emotion=happy').set(ana);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: expect.stringContaining('no está disponible') });
    expect(JSON.stringify(res.body)).not.toContain('401');
    expect(consoleError).toHaveBeenCalled(); // el detalle sí queda en el log del servidor
  });

  it('responde 500 ante un error inesperado', async () => {
    const tmdb = makeFakeTmdb(async () => {
      throw new Error('bug interno');
    });
    const res = await request(build(tmdb)).get('/api/recommendations?emotion=happy').set(ana);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
  });
});
