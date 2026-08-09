import { defineConfig, devices } from '@playwright/test';

// Config Playwright para CEA NOCTUA · smoke tests + validación E2E del módulo T&T (F19).
//
// Requiere:
//   - VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY en .env.local (o system env)
//   - E2E_USER + E2E_PASS para el flujo de login (opcional, si se saltan tests
//     que necesitan sesión).
//
// Ejecutar:
//   npm run e2e            # todos los tests
//   npm run e2e -- --grep smoke   # solo smoke tests
//   npx playwright test --ui      # UI mode interactivo

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false, // Un test por vez para no saturar el dev server
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:9000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:9000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
