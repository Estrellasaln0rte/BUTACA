import { defineConfig, devices } from '@playwright/test';
import { E2E } from './constantes.js';

// Pruebas de punta a punta: un navegador real recorre la app como lo haría un usuario.
// El front corre con un Supabase y una API de mentira (ver tests/fixtures.js), así las pruebas
// no necesitan credenciales reales ni tocan la base de datos, y corren igual en el CI.
const PUERTO = 5174; // distinto al 5173 de desarrollo, para no reutilizar un front con el .env real

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // un test.only olvidado hace fallar el CI
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev --workspace frontend -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    cwd: '..',
    timeout: 60_000,
    // Las variables del proceso le ganan al frontend/.env, así nunca se usan las credenciales reales.
    env: {
      VITE_SUPABASE_URL: E2E.supabaseUrl,
      VITE_SUPABASE_ANON_KEY: 'anon-key-de-prueba',
      VITE_API_URL: E2E.apiUrl,
      // Una key "secreta" en el entorno del front: seguridad.spec.js revisa que NO termine en el navegador
      TMDB_API_KEY: E2E.claveSecreta,
    },
  },
});