import { test, expect } from '@playwright/test';

// Tests del módulo T&T (Arriaza) tras F19-3.
// Requieren login — usa E2E_USER + E2E_PASS o skip.

const email = process.env.E2E_USER;
const password = process.env.E2E_PASS;
const shouldSkip = !email || !password;

test.describe('arriaza (T&T)', () => {
  test.skip(shouldSkip, 'E2E_USER + E2E_PASS no configurados');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Los inputs son type="email" y type="password" — selectors robustos.
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|)?$/, { timeout: 15_000 });
  });

  test('página /arriaza carga y muestra el hero T&T', async ({ page }) => {
    await page.goto('/arriaza');
    // Hero debe aparecer con el texto característico del módulo.
    await expect(page.getByText(/Tour.*Travel|T&T|Arriaza/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('botón "Crear Viaje" abre el modal', async ({ page }) => {
    await page.goto('/arriaza');
    const btn = page.getByRole('button', { name: /Crear Viaje|Nuevo Viaje/i }).first();
    await btn.click();
    // Modal debe mostrar campos clave.
    await expect(page.getByText(/Título|Fecha inicio/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('crear viaje mínimo + eliminar (smoke del CRUD)', async ({ page }) => {
    await page.goto('/arriaza');
    await page.getByRole('button', { name: /Crear Viaje|Nuevo Viaje/i }).first().click();

    const titulo = `E2E test ${Date.now()}`;
    await page.getByLabel(/Título/i).first().fill(titulo);
    await page.getByLabel(/Fecha inicio/i).first().fill('2027-01-01');
    await page.getByLabel(/Fecha fin/i).first().fill('2027-01-05');
    await page.getByLabel(/Destino/i).first().fill('Test City');
    await page.getByRole('button', { name: /Guardar/i }).first().click();

    // El viaje debe aparecer en la lista.
    await expect(page.getByText(titulo)).toBeVisible({ timeout: 10_000 });

    // Borrarlo (cleanup).
    const card = page.locator(`text=${titulo}`).locator('..').locator('..');
    await card.getByRole('button', { name: /Eliminar|🗑/ }).first().click();
    // Confirmar el prompt del navegador.
    page.on('dialog', (d) => d.accept());
    await expect(page.getByText(titulo)).not.toBeVisible({ timeout: 10_000 });
  });
});
