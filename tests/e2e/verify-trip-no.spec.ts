import { test, expect } from '@playwright/test';

const email = process.env.E2E_USER!;
const password = process.env.E2E_PASS!;

// Intercepta el response de att_viajes que hace la propia app (evita el problema
// del anon key). Devuelve el JSON completo con trip_no visible o null.
test('verify: trip_no en el response real de att_viajes', async ({ page }) => {
  let body: string | null = null;
  page.on('response', async (res) => {
    if (res.url().includes('att_viajes?select=')) {
      try { body = await res.text(); } catch { /* ignore */ }
    }
  });

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|)?$/, { timeout: 15_000 });
  await page.goto('/arriaza');
  await page.waitForFunction(
    () => !document.body.innerText.trim().startsWith('Cargando'),
    { timeout: 15_000 },
  ).catch(() => {});
  // Espera adicional por el fetch de att_viajes.
  await page.waitForTimeout(3000);

  console.log('\n===== ATT_VIAJES RESPONSE =====');
  if (body) {
    // Parse + extraer campos relevantes.
    try {
      const parsed = JSON.parse(body);
      console.log(JSON.stringify(parsed.map((v: { id: string; titulo: string; trip_no: string | null; manual_status: string; fecha_ini: string | null }) => ({
        titulo: v.titulo,
        trip_no: v.trip_no,
        manual_status: v.manual_status,
        fecha_ini: v.fecha_ini,
      })), null, 2));
    } catch {
      console.log(body.slice(0, 500));
    }
  } else {
    console.log('(no att_viajes response capturado)');
  }
  expect(body).not.toBeNull();
});
