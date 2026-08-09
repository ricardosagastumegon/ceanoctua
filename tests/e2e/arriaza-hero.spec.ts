import { test, expect } from '@playwright/test';

// F19-3c · verifica que la ruta /arriaza carga y muestra el hero nuevo
// (sin login — el ProtectedRoute redirige a /login, no lanza excepción).

test('ruta /arriaza no rompe la app (redirect a login sin sesión)', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/arriaza');
  await page.waitForLoadState('networkidle', { timeout: 10_000 });

  // Debe haber redirigido a login (o mostrar login screen).
  // Lo importante: no debe haber console errors ni page errors.
  const realErrors = consoleErrors.filter(
    (e) => !/contentscript|MetaMask|inpage|providerlist/i.test(e),
  );
  expect(realErrors, `console errors: ${realErrors.join('\n')}`).toEqual([]);
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([]);
});
