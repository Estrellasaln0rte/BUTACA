import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const disconnect = vi.fn().mockResolvedValue(undefined);
  return { disconnect, PrismaClient: vi.fn(function () { return { $disconnect: disconnect }; }) };
});

vi.mock('@prisma/client', () => ({ PrismaClient: mocks.PrismaClient }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('cliente Prisma reutilizable', () => {
  it('importar no construye el cliente; los usos posteriores comparten instancia', async () => {
    const { getPrismaClient } = await import('../../lib/prisma.js');
    expect(mocks.PrismaClient).not.toHaveBeenCalled();
    expect(getPrismaClient()).toBe(getPrismaClient());
    expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  });

  it('permite cerrar una sola vez y crear otra instancia después', async () => {
    const { getPrismaClient, disconnectPrisma } = await import('../../lib/prisma.js');
    await disconnectPrisma();
    expect(mocks.disconnect).not.toHaveBeenCalled();
    const first = getPrismaClient();
    await disconnectPrisma();
    await disconnectPrisma();
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(getPrismaClient()).not.toBe(first);
    expect(mocks.PrismaClient).toHaveBeenCalledTimes(2);
  });

  it('las fábricas comparten el cliente por defecto y respetan un cliente inyectado', async () => {
    const { createRepositories } = await import('../index.js');
    createRepositories({ prisma: {} });
    expect(mocks.PrismaClient).not.toHaveBeenCalled();
    createRepositories();
    createRepositories();
    expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  });
});
