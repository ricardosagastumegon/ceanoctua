import { test, expect } from '@playwright/test';
import path from 'node:path';

// Playwright compare · abre el standalone HTML y CEA en paralelo, screenshot
// ambos y guarda en test-results/ para review visual manual.
//
// Ejecutar con:
//   E2E_BASE_URL=http://localhost:9000 \
//     TT_HTML_PATH="C:/Users/PC/Downloads/RESPALDO_TT_modulo_CEA (1)/backup_tt/TT_modulo.html" \
//     npx playwright test compare-html-vs-cea
//
// O más simple:
//   npm run e2e -- --grep compare
//
// Si tenés E2E_USER/PASS, también loguea a CEA. Sino solo screenshotea el
// login screen + el HTML.

const htmlPath = process.env.TT_HTML_PATH ??
  'C:/Users/PC/Downloads/RESPALDO_TT_modulo_CEA (1)/backup_tt/TT_modulo.html';
const email = process.env.E2E_USER;
const password = process.env.E2E_PASS;

test.describe('compare @compare · CEA vs standalone HTML', () => {
  test('screenshot standalone HTML dashboard', async ({ page }) => {
    const url = 'file:///' + htmlPath.replace(/\\/g, '/');
    await page.goto(url);
    // Espera a que ttInit renderee el hero.
    await page.waitForSelector('.tt-hero-title', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: 'test-results/compare_html_dashboard.png',
      fullPage: true,
    });
  });

  test('screenshot standalone HTML · click "+ Agregar Servicios"', async ({ page }) => {
    const url = 'file:///' + htmlPath.replace(/\\/g, '/');
    await page.goto(url);
    await page.waitForTimeout(2000);
    // Buscar el primer botón "+ Agregar Servicios" y hacer click.
    const btn = page.locator('button:has-text("Agregar Servicios")').first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: 'test-results/compare_html_addservicios_dropdown.png',
        fullPage: false,
      });
    } else {
      console.log('No "+ Agregar Servicios" button found in HTML — hay trips creados?');
    }
  });

  test('screenshot CEA /arriaza', async ({ page }) => {
    test.skip(!email || !password, 'E2E_USER + E2E_PASS no configurados');
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|)?$/, { timeout: 15_000 });
    await page.goto('/arriaza');
    // Esperar hasta que el splash "Cargando…" desaparezca (bootstrap auth
    // puede tardar hasta 6s por el timeout de C-1 v4). Máx 15s.
    await page.waitForFunction(
      () => !document.body.innerText.trim().startsWith('Cargando'),
      { timeout: 15_000 },
    ).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'test-results/compare_cea_arriaza.png',
      fullPage: true,
    });
  });

  test('screenshot CEA · click "+ Agregar Servicios" (verifica portal fix)', async ({ page }) => {
    test.skip(!email || !password, 'E2E_USER + E2E_PASS no configurados');
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|)?$/, { timeout: 15_000 });
    await page.goto('/arriaza');
    // Esperar hasta que el splash "Cargando…" desaparezca (bootstrap auth
    // puede tardar hasta 6s por el timeout de C-1 v4). Máx 15s.
    await page.waitForFunction(
      () => !document.body.innerText.trim().startsWith('Cargando'),
      { timeout: 15_000 },
    ).catch(() => {});
    await page.waitForTimeout(500);
    // Click en el primer "+ Agregar Servicios".
    const btn = page.locator('button:has-text("Agregar Servicios")').first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(300);
      // El dropdown debe existir en document.body (portal) — verificar:
      const menu = page.locator('#tt-addserv-menu');
      await expect(menu).toBeVisible();
      // El dropdown debe mostrar 14 opciones.
      const items = menu.locator('button');
      const count = await items.count();
      expect(count, 'el dropdown debe tener 14 servicios').toBe(14);
      await page.screenshot({
        path: 'test-results/compare_cea_addservicios_dropdown.png',
        fullPage: false,
      });
    } else {
      console.log('No hay viajes activos en CEA para probar "+ Agregar Servicios".');
    }
  });

  test('verifica que los viajes tienen trip_no visible (post-backfill)', async ({ page }) => {
    test.skip(!email || !password, 'E2E_USER + E2E_PASS no configurados');
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|)?$/, { timeout: 15_000 });
    await page.goto('/arriaza');
    // Esperar hasta que el splash "Cargando…" desaparezca (bootstrap auth
    // puede tardar hasta 6s por el timeout de C-1 v4). Máx 15s.
    await page.waitForFunction(
      () => !document.body.innerText.trim().startsWith('Cargando'),
      { timeout: 15_000 },
    ).catch(() => {});
    await page.waitForTimeout(500);
    // Los trip cards deben mostrar el badge trip_no tipo TT-2026-####.
    const tripNoBadges = page.locator('text=/TT-\\d{4}-\\d{4}/');
    const count = await tripNoBadges.count();
    console.log(`Encontrados ${count} viajes con trip_no visible.`);
    // No hacemos hard-assert porque podría no haber viajes.
    // Solo screenshotamos para review manual.
    await page.screenshot({
      path: 'test-results/compare_cea_trip_no_visible.png',
      fullPage: false,
    });
  });
});
