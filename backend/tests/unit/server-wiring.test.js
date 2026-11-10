import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const repos = {
    profilesRepo: {}, moodsRepo: {}, favoritesRepo: {}, recommendationsRepo: {}, dashboardRepo: {},
  };
  const verifyToken = vi.fn();
  const tmdb = { discover: vi.fn() };
  const router = {};
  const server = {};
  const listen = vi.fn();
  const disconnectPrisma = vi.fn();
  return {
    repos, verifyToken, tmdb, router, server, listen, disconnectPrisma,
    registerShutdown: vi.fn(),
    createRepositories: vi.fn(() => repos),
    createSupabaseVerifier: vi.fn(() => verifyToken),
    createTmdbClient: vi.fn(() => tmdb),
    recommendationsRouter: vi.fn(() => router),
    createApp: vi.fn(() => ({ listen })),
  };
});

// Evita cargar .env, construir un cliente real o abrir un puerto al importar server.
vi.mock('../../src/config/env.js', () => ({ env: {
  FRONTEND_URL: 'http://localhost:5173', NODE_ENV: 'test', PORT: 3000,
  SUPABASE_URL: 'https://auth.butaca.test', SUPABASE_ANON_KEY: 'test-public-key',
  TMDB_API_KEY: 'test-tmdb-key',
} }));
vi.mock('../../src/repositories/index.js', () => ({ createRepositories: mocks.createRepositories }));
vi.mock('../../src/lib/supabase.js', () => ({ createSupabaseVerifier: mocks.createSupabaseVerifier }));
vi.mock('../../src/services/tmdb.js', () => ({ createTmdbClient: mocks.createTmdbClient }));
vi.mock('../../src/routes/recommendations.js', () => ({ recommendationsRouter: mocks.recommendationsRouter }));
vi.mock('../../src/app.js', () => ({ createApp: mocks.createApp }));
// Evita registrar señales reales en el proceso de las pruebas.
vi.mock('../../src/lib/shutdown.js', () => ({ registerShutdown: mocks.registerShutdown }));
vi.mock('../../src/lib/prisma.js', () => ({ disconnectPrisma: mocks.disconnectPrisma }));

afterEach(() => vi.restoreAllMocks());

it('server conecta los repositorios y usa el verificador de Supabase para las rutas privadas', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.listen.mockImplementation((_port, ready) => {
    ready();
    return mocks.server;
  });
  await import('../../src/server.js');
  expect(mocks.createRepositories).toHaveBeenCalledTimes(1);
  expect(mocks.createSupabaseVerifier).toHaveBeenCalledWith({
    url: 'https://auth.butaca.test', anonKey: 'test-public-key',
  });
  expect(mocks.recommendationsRouter).toHaveBeenCalledWith({
    tmdb: mocks.tmdb, recommendationsRepo: mocks.repos.recommendationsRepo,
  });
  expect(mocks.createApp).toHaveBeenCalledWith({
    frontendUrl: 'http://localhost:5173', nodeEnv: 'test',
    verifyToken: mocks.verifyToken, repos: mocks.repos, recommendationsRouter: mocks.router,
  });
  expect(mocks.listen).toHaveBeenCalledWith(3000, expect.any(Function));
  // Al apagar, cierra el servidor que se levantó y desconecta Prisma.
  expect(mocks.registerShutdown).toHaveBeenCalledWith({
    server: mocks.server, cleanup: mocks.disconnectPrisma,
  });
});
