import { test, expect } from '@playwright/test';

// Smoke tests: verifican que la app carga sin errores críticos.
// Sin login — sólo validan que:
//   - Login screen renderiza
//   - No hay errores de console tipo TypeError, ReferenceError, etc.
//   - El bundle inicial se sirve sin 404s

test.describe('smoke @smoke', () => {
  test('login screen carga sin errores de console', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');

    // La app debe montar algo en <=8s (guarda contra el bug C-1 del bootstrap).
    await expect(page.locator('body')).toBeVisible({ timeout: 8_000 });

    // No debe quedarse en el splash "Cargando…" para siempre.
    // Ver: docs/AUDIT-2026-07-12.md · finding C-1.
    await page.waitForTimeout(3_000);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText, 'app no debe quedarse en Cargando… (bug C-1)').not.toMatch(/^Cargando…\s*$/);

    // Filtrar warnings de MetaMask/extensiones (no son nuestros).
    const realErrors = consoleErrors.filter(
      (e) => !/contentscript|MetaMask|inpage|providerlist/i.test(e),
    );
    expect(realErrors, `console errors: ${realErrors.join('\n')}`).toEqual([]);
    expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([]);
  });

  test('bundle inicial se sirve sin 404s', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('supabase.co')) {
        failed.push(`${res.status()} ${res.url()}`);
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    expect(failed, `requests failed: ${failed.join('\n')}`).toEqual([]);
  });
});
