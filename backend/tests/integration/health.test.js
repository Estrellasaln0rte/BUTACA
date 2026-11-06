import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

// Prueba de humo: confirma que la plantilla y el CI funcionan.
describe('GET /api/health', () => {
  it('responde 200 con status ok', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
