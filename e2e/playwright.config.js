import { defineConfig } from '@playwright/test';

// Pruebas de punta a punta: un navegador real recorre la app como lo haría un usuario.
export default defineConfig({
  testDir: './tests',
  reporter: [['html', { open: 'never', outputFolder: '../playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev:front',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    cwd: '..',
  },
});
