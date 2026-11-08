import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/server.js', 'src/lib/supabase.js'],
      // Si la cobertura baja de aquí, el CI se pone en rojo.
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});