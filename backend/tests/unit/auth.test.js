import { describe, it, expect, vi } from 'vitest';
import { createRequireAuth } from '../../src/middlewares/auth.js';

function run(headers, verifyToken) {
  const req = { header: (n) => headers[n.toLowerCase()] };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  return createRequireAuth(verifyToken)(req, res, next).then(() => ({ req, res, next }));
}

describe('requireAuth', () => {
  it('401 si no hay header Authorization', async () => {
    const { res, next } = await run({}, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 si el esquema no es Bearer', async () => {
    const { res } = await run({ authorization: 'Basic abc' }, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('401 si el token es inválido', async () => {
    const { res, next } = await run({ authorization: 'Bearer malo' }, async () => null);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar y pone req.user con un token válido', async () => {
    const { req, next } = await run({ authorization: 'Bearer ok' }, async () => ({ id: 'u1' }));
    expect(req.user).toEqual({ id: 'u1' });
    expect(next).toHaveBeenCalledWith();
  });

  it('acepta el esquema "bearer" sin importar mayúsculas', async () => {
    const { req, next } = await run({ authorization: 'bearer ok' }, async () => ({ id: 'u1' }));
    expect(req.user).toEqual({ id: 'u1' });
    expect(next).toHaveBeenCalledWith();
  });

  it('pasa el error a next si el verificador falla', async () => {
    const boom = new Error('supabase caído');
    const { next } = await run({ authorization: 'Bearer ok' }, async () => {
      throw boom;
    });
    expect(next).toHaveBeenCalledWith(boom);
  });
});