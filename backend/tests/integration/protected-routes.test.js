import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { fakeVerifyToken, makeFakeRepos } from '../helpers/fakes.js';

const build = (extra = {}) =>
  createApp({
    frontendUrl: 'http://localhost:5173',
    verifyToken: fakeVerifyToken,
    repos: makeFakeRepos(),
    ...extra,
  });

const ana = { Authorization: 'Bearer token-ana' };
const beto = { Authorization: 'Bearer token-beto' };

describe('rutas protegidas: autenticación', () => {
  const rutas = [
    ['get', '/api/favorites'],
    ['post', '/api/favorites'],
    ['delete', '/api/favorites/movie/550'],
    ['get', '/api/moods'],
    ['post', '/api/moods'],
    ['get', '/api/dashboard'],
  ];

  it.each(rutas)('%s %s responde 401 sin token', async (metodo, ruta) => {
    const res = await request(build())[metodo](ruta);
    expect(res.status).toBe(401);
  });

  it('responde 401 con un token inválido', async () => {
    const res = await request(build()).get('/api/favorites').set('Authorization', 'Bearer falso');
    expect(res.status).toBe(401);
  });

  it('sin verificador configurado, todo queda cerrado', async () => {
    const res = await request(createApp({ repos: makeFakeRepos() }))
      .get('/api/favorites')
      .set(ana);
    expect(res.status).toBe(401);
  });

  it('/api/health sigue siendo público', async () => {
    const res = await request(build()).get('/api/health');
    expect(res.status).toBe(200);
  });
});

describe('favoritos', () => {
  const peli = { tmdbId: 550, mediaType: 'movie', title: 'El club de la pelea', posterPath: '/abc.jpg' };

  it('guarda y lista favoritos del usuario', async () => {
    const app = build();
    const created = await request(app).post('/api/favorites').set(ana).send(peli);
    expect(created.status).toBe(201);
    expect(created.body.tmdbId).toBe(550);

    const list = await request(app).get('/api/favorites').set(ana);
    expect(list.body.items).toHaveLength(1);
  });

  it('cada usuario ve SOLO lo suyo', async () => {
    const app = build();
    await request(app).post('/api/favorites').set(ana).send(peli);

    const delBeto = await request(app).get('/api/favorites').set(beto);
    expect(delBeto.body.items).toHaveLength(0);
  });

  it('un usuario no puede borrar el favorito de otro', async () => {
    const app = build();
    await request(app).post('/api/favorites').set(ana).send(peli);

    const res = await request(app).delete('/api/favorites/movie/550').set(beto);
    expect(res.status).toBe(404);

    const list = await request(app).get('/api/favorites').set(ana);
    expect(list.body.items).toHaveLength(1);
  });

  it('borra un favorito propio (204) y luego da 404', async () => {
    const app = build();
    await request(app).post('/api/favorites').set(ana).send(peli);
    expect((await request(app).delete('/api/favorites/movie/550').set(ana)).status).toBe(204);
    expect((await request(app).delete('/api/favorites/movie/550').set(ana)).status).toBe(404);
  });

  it('400 con datos inválidos y detalle de campos', async () => {
    const res = await request(build()).post('/api/favorites').set(ana).send({ tmdbId: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('tmdbId');
  });

  it('400 con params inválidos', async () => {
    const res = await request(build()).delete('/api/favorites/anime/abc').set(ana);
    expect(res.status).toBe(400);
  });
});

describe('ánimos y tablero', () => {
  it('registra un ánimo', async () => {
    const res = await request(build()).post('/api/moods').set(ana).send({ emotion: 'happy', confidence: 0.9 });
    expect(res.status).toBe(201);
    expect(res.body.emotion).toBe('happy');
  });

  it('GET /api/moods devuelve los ánimos del usuario', async () => {
    const app = build();
    await request(app).post('/api/moods').set(ana).send({ emotion: 'happy' });
    await request(app).post('/api/moods').set(ana).send({ emotion: 'sad' });
    await request(app).post('/api/moods').set(beto).send({ emotion: 'angry' });

    const res = await request(app).get('/api/moods').set(ana);
    expect(res.status).toBe(200);
    expect(res.body.items.map((m) => m.emotion)).toEqual(['happy', 'sad']);
  });

  it('GET /api/moods respeta el parámetro limit', async () => {
    const app = build();
    for (const emotion of ['happy', 'sad', 'angry']) {
      await request(app).post('/api/moods').set(ana).send({ emotion });
    }

    const res = await request(app).get('/api/moods?limit=2').set(ana);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it('GET /api/moods rechaza un limit inválido (400)', async () => {
    const app = build();
    expect((await request(app).get('/api/moods?limit=0').set(ana)).status).toBe(400);
    expect((await request(app).get('/api/moods?limit=999').set(ana)).status).toBe(400);
  });

  it('rechaza una imagen escondida en el body', async () => {
    const res = await request(build())
      .post('/api/moods')
      .set(ana)
      .send({ emotion: 'happy', image: 'data:image/png;base64,AAAA' });
    expect(res.status).toBe(400);
  });

  it('el tablero solo incluye los ánimos del usuario', async () => {
    const app = build();
    await request(app).post('/api/moods').set(ana).send({ emotion: 'sad' });
    await request(app).post('/api/moods').set(beto).send({ emotion: 'angry' });

    const res = await request(app).get('/api/dashboard?days=7').set(ana);
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
    expect(res.body.moodsOverTime).toHaveLength(1);
    expect(res.body.moodsOverTime[0].emotion).toBe('sad');
  });

  it('400 si days está fuera de rango', async () => {
    const res = await request(build()).get('/api/dashboard?days=5000').set(ana);
    expect(res.status).toBe(400);
  });
});