/**
 * Comprueba el lector de facturas contra las plantillas reales que existen.
 *
 *   node scripts/probar-lector-facturas.mjs
 *
 * POR QUÉ ESTO EXISTE. El lector no adivina: lee datos que el régimen FEL
 * obliga a que estén. Pero cada certificador acomoda la hoja a su gusto, así
 * que las expresiones que lo leen están afinadas contra plantillas CONCRETAS.
 * Tocar una regex para que entre una cuarta factura puede romper las tres que
 * ya funcionaban, y eso no da ningún error: simplemente deja de encontrar un
 * campo, y la solicitud de pago sale con un dato menos.
 *
 * CÓMO AGREGAR UNA PLANTILLA NUEVA. El texto de la factura --no el PDF-- va a
 * `reference/facturas/`, y su resultado esperado aquí abajo. Para sacar el
 * texto de un PDF nuevo, la misma función que usa la app:
 * `textoDelPdf` de `src/lib/pdf-texto.ts`, que lo ordena por posición y no por
 * el orden en que está escrito dentro del archivo.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Lo que cada plantilla tiene que dar. Medido a mano contra el PDF. */
const ESPERADO = {
  'aeronaves-infile.txt': {
    autorizacion: '75ED0611-FCFA-4A4D-9748-10FB08EF78FF',
    serie: '75ED0611',
    numero: '4244261453',
    fecha: '2026-10-05',
    total: 1500,
    moneda: 'GTQ',
    nitEmisor: '347469',
    nombreEmisor: 'Aeronaves, S. A.',
    nitReceptor: '16896637',
    nombreReceptor: 'BANANERA IZABAL, S.A.',
    descripcion: 'SERVICIO DE OXIGENO. TG-OBI.',
  },
  'ovalle-infile.txt': {
    autorizacion: 'E1C87A9C-9DCC-43B0-A965-9BF323D414B1',
    serie: 'E1C87A9C',
    numero: '2647409584',
    fecha: '2026-11-09',
    total: 1120,
    moneda: 'GTQ',
    nitEmisor: '7363982',
    nombreEmisor: 'CARLOS MANUEL , OVALLE LERANOZ',
    nitReceptor: '22931406',
    nombreReceptor: 'BALY SOCIEDAD ANÓNIMA',
    descripcion: 'Honorarios Profesionales correspondientes al mes de noviembre 2026',
  },
  'aventura-maya-pequenio-contribuyente.txt': {
    autorizacion: '6320149F-8643-408E-81F2-F5EE382B23C7',
    serie: '6320149F',
    numero: '2252554382',
    fecha: '2026-11-16',
    total: 5040,
    moneda: 'GTQ',
    nitEmisor: '38812088',
    nombreEmisor: 'CEILY YUVIKSA , MORALES ROQUE DE ACEVEDO',
    nitReceptor: '7507658',
    nombreReceptor: 'AGRO ATLANTIC, SOCIEDAD ANONIMA',
    descripcion: 'Renta de Bus Pullman',
  },
};

const salida = path.join(RAIZ, 'node_modules', '.cache', 'lector-facturas.mjs');
await build({
  entryPoints: [path.join(RAIZ, 'src/modules/finanzas/pagos/leerFacturaSP.ts')],
  bundle: true,
  format: 'esm',
  outfile: salida,
  platform: 'node',
  // `pdfjs` no hace falta para parsear un texto ya extraído, y pedirlo aquí
  // obligaría a tener un worker de navegador en Node.
  external: ['pdfjs-dist', 'pdfjs-dist/*'],
  alias: { '@': path.join(RAIZ, 'src') },
  logLevel: 'error',
});
const { parsearFacturaSP } = await import(pathToFileURL(salida).href + `?v=${Date.now()}`);

let mal = 0;
let campos = 0;
for (const [archivo, esperado] of Object.entries(ESPERADO)) {
  const ruta = path.join(RAIZ, 'reference', 'facturas', archivo);
  if (!fs.existsSync(ruta)) {
    console.log(`  ✗ falta la plantilla ${archivo}`);
    mal++;
    continue;
  }
  const leido = parsearFacturaSP(fs.readFileSync(ruta, 'utf8'));
  for (const [campo, valor] of Object.entries(esperado)) {
    campos++;
    if (String(leido[campo]) !== String(valor)) {
      console.log(`  ✗ ${archivo} · ${campo}: esperaba «${valor}», dio «${leido[campo]}»`);
      mal++;
    }
  }
}

const n = Object.keys(ESPERADO).length;
console.log(
  mal === 0
    ? `OK · ${campos} campos en ${n} plantillas, 0 diferencias`
    : `${mal} diferencia(s) en ${campos} campos`,
);
process.exit(mal === 0 ? 0 : 1);
