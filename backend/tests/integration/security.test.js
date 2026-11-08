import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../../src/app.js';
import { fakeVerifyToken, makeFakeRepos } from '../helpers/fakes.js';

const build = (extra = {}) =>
  createApp({
    frontendUrl: 'http://localhost:5173',
    verifyToken: fakeVerifyToken,
    repos: makeFakeRepos(),
    ...extra,
  });

describe('seguridad', () => {
  it('helmet agrega cabeceras de seguridad', async () => {
    const res = await request(build()).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('CORS permite solo el origen del front', async () => {
    const ok = await request(build()).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const otro = await request(build()).get('/api/health').set('Origin', 'http://sitio-malo.com');
    expect(otro.headers['access-control-allow-origin']).toBe('http://localhost:5173'); // nunca el origen malicioso
  });

  it('responde el preflight OPTIONS con los headers permitidos', async () => {
    const res = await request(build())
      .options('/api/favorites')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toMatch(/Authorization/i);
  });

  it('rate limit: devuelve 429 al pasarse del límite', async () => {
    const app = build({ limits: { general: { limit: 3 } } });
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await request(app).get('/api/health')).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });

  it('el límite estricto protege /api/recommendations', async () => {
    const recs = express.Router().get('/', (_req, res) => res.json({ items: [] }));
    const app = build({ recommendationsRouter: recs, limits: { strict: { limit: 2 } } });
    const auth = { Authorization: 'Bearer token-ana' };
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await request(app).get('/api/recommendations').set(auth)).status);
    expect(codes).toEqual([200, 200, 429]);
  });

  it('/api/recommendations exige sesión', async () => {
    const recs = express.Router().get('/', (_req, res) => res.json({ items: [] }));
    const res = await request(build({ recommendationsRouter: recs })).get('/api/recommendations');
    expect(res.status).toBe(401);
  });

  it('rechaza bodies de más de 10 KB (413)', async () => {
    const res = await request(build())
      .post('/api/moods')
      .set('Authorization', 'Bearer token-ana')
      .send({ emotion: 'happy', basura: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
  });

  it('400 con JSON malformado', async () => {
    const res = await request(build())
      .post('/api/moods')
      .set('Authorization', 'Bearer token-ana')
      .set('Content-Type', 'application/json')
      .send('{ no es json');
    expect(res.status).toBe(400);
  });

  it('404 para rutas inexistentes', async () => {
    const res = await request(build()).get('/api/no-existe');
    expect(res.status).toBe(404);
  });

  it('un error interno devuelve 500 sin filtrar detalles', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const repos = makeFakeRepos();
    repos.favoritesRepo.list = async () => {
      throw new Error('password=secreta en la conexión');
    };
    const res = await request(build({ repos })).get('/api/favorites').set('Authorization', 'Bearer token-ana');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secreta/);
    expect(spy).toHaveBeenCalled(); // sí queda registrado en el log del servidor
    spy.mockRestore();
  });

    it('en producción rechaza HTTP plano (426) y nunca redirige según el Host', async () => {
    const res = await request(build({ nodeEnv: 'production' })).get('/api/health').set('Host', 'sitio-malo.com');
    expect(res.status).toBe(426);
    expect(res.headers.location).toBeUndefined();
  });

  it('CORS ignora la "/" final de FRONTEND_URL', async () => {
    const app = build({ frontendUrl: 'http://localhost:5173/' });
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('sin FRONTEND_URL no se habilita CORS para nadie', async () => {
    const app = build({ frontendUrl: undefined });
    const res = await request(app).get('/api/health').set('Origin', 'http://sitio-malo.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('un favorito duplicado (P2002 de Prisma) responde 409, no 500', async () => {
    const repos = makeFakeRepos();
    repos.favoritesRepo.add = async () => {
      throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
    };
    const res = await request(build({ repos }))
      .post('/api/favorites')
      .set('Authorization', 'Bearer token-ana')
      .send({ tmdbId: 550, mediaType: 'movie', title: 'X' });
    expect(res.status).toBe(409);
  });

  it('en producción acepta tráfico que ya llegó por HTTPS (proxy)', async () => {
    const res = await request(build({ nodeEnv: 'production' }))
      .get('/api/health')
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
  });
});