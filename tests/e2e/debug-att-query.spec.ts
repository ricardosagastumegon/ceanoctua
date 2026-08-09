import { test, expect } from '@playwright/test';

// Debug: capturar los network requests + console errors al cargar /arriaza
// para diagnosticar por qué "Cargando viajes…" no termina.

const email = process.env.E2E_USER!;
const password = process.env.E2E_PASS!;

test('debug: qué pasa cuando /arriaza fetch att_viajes', async ({ page }) => {
  const network: string[] = [];
  const consoleErrors: string[] = [];
  const consoleLogs: string[] = [];

  page.on('request', (req) => {
    if (req.url().includes('att_viajes') || req.url().includes('usuarios')) {
      network.push(`→ ${req.method()} ${req.url().replace(/https:\/\/[^/]+/, '')}`);
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('att_viajes') || res.url().includes('usuarios')) {
      let bodyPreview = '';
      try {
        const text = await res.text();
        bodyPreview = text.length > 300 ? text.slice(0, 300) + '…' : text;
      } catch {
        bodyPreview = '(no readable body)';
      }
      network.push(`← ${res.status()} ${res.url().replace(/https:\/\/[^/]+/, '')}\n    ${bodyPreview}`);
    }
  });
  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error') consoleErrors.push(msg.text());
    else if (t === 'warning' || t === 'log') consoleLogs.push(`[${t}] ${msg.text()}`);
  });

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|)?$/, { timeout: 15_000 });
  await page.goto('/arriaza');
  // Esperar 12s para dar tiempo a que resuelva o falle el fetch.
  await page.waitForTimeout(12_000);

  console.log('\n===== NETWORK att_viajes + usuarios =====');
  for (const line of network) console.log(line);
  console.log('\n===== CONSOLE ERRORS (filtered) =====');
  const real = consoleErrors.filter((e) => !/contentscript|MetaMask/i.test(e));
  for (const e of real) console.log(e);
  console.log('\n===== CONSOLE LOGS =====');
  for (const l of consoleLogs.slice(-20)) console.log(l);

  // Sanity assertion: al menos hubo un intento de fetch a att_viajes.
  expect(network.length, 'debe haber requests a att_viajes').toBeGreaterThan(0);
});
