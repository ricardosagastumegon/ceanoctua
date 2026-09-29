// Carga por única vez el estado de cuenta del proveedor de combustible.
//
//   node scripts/importar-estado-cuenta-fuel.mjs <archivo.xls> <matricula> [--aplicar]
//
// Sin `--aplicar` no escribe nada: lee, arma los movimientos y dice qué saldo
// darían. Con `--aplicar` crea la cuenta --si no existe-- y carga la historia.
//
// De aquí en adelante no hay más importaciones: las facturas las captura CEA
// y las reposiciones se registran en la pantalla. El Excel del proveedor solo
// sirve para conciliar.
//
// ── La hoja ───────────────────────────────────────────────────────────────
// Columnas: Documento | Fecha | Comentario | S.Anterior | Cargos | Abonos |
// S.Final. El saldo del proveedor va NEGATIVO cuando hay dinero a favor; acá
// se guarda el disponible en positivo y el signo lo pone `tipo`.
//
// `S.Anterior` y `S.Final` no se guardan: son derivables del orden. Sí se usan
// para VERIFICAR que la lectura sea correcta, que es justo para lo que sirven.

import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';

const [, , archivo, matricula, ...flags] = process.argv;
const aplicar = flags.includes('--aplicar');
// Reemplaza la historia ya cargada por la de este archivo. Es lo que hace
// falta cuando llega un estado de cuenta más reciente: la cuenta es la
// misma, la historia se corre hasta la nueva fecha de corte.
const reemplazar = flags.includes('--reemplazar');

if (!archivo || !matricula) {
  console.error('uso: node scripts/importar-estado-cuenta-fuel.mjs <archivo.xls> <matricula> [--aplicar] [--reemplazar]');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

/** Consulta directa por el API de management: el anon key no pasa el RLS. */
async function sql(query) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SUPABASE_PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    },
  );
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  return JSON.parse(txt);
}

const lit = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => {
  const x = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(x) ? x : null;
};

/**
 * `5/2/24` → `2024-05-02`. La hoja viene en M/D/YY.
 *
 * Devuelve null si el texto no es una fecha válida. El Excel del proveedor
 * trae al menos una corrupta --`22/02/202` en FER1040281-- y acá no se
 * adivina: una fecha inventada en un estado de cuenta es peor que una vacía.
 * Quien llama guarda el texto original en el comentario para no perderlo.
 */
function fecha(v) {
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const [, mes, dia, anio] = m;
  if (anio.length === 3) return null;
  const a = anio.length === 2 ? 2000 + Number(anio) : Number(anio);
  if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// ── 1 · Leer la hoja ───────────────────────────────────────────────────────
const wb = XLSX.readFile(archivo);
const hoja = wb.SheetNames.find((n) => /estado de cue/i.test(n));
if (!hoja) throw new Error(`no encontré la pestaña del estado de cuenta en ${wb.SheetNames.join(', ')}`);
const filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: false, defval: '' });

const movs = [];
const sinFecha = [];
let anterior = null;
let rotas = 0;

for (const f of filas) {
  const sAnt = num(f[3]);
  const sFin = num(f[6]);
  if (sAnt === null || sFin === null) continue;   // encabezados y pies de página

  const cargo = num(f[4]) || 0;
  const abono = num(f[5]) || 0;

  // La fila tiene que cerrar contra sí misma y contra la anterior. Si algo de
  // esto falla, la lectura está mal y no tiene caso seguir.
  if (Math.abs(sAnt + cargo - abono - sFin) > 0.011) rotas++;
  if (anterior !== null && Math.abs(sAnt - anterior) > 0.011) rotas++;
  anterior = sFin;

  const doc = String(f[0]).trim();
  let com = String(f[2]).trim();

  // Fecha ilegible en el origen: se guarda el texto tal cual en el comentario
  // en vez de perderlo o de inventar un día.
  const crudo = String(f[1]).trim();
  const fe = fecha(crudo);
  if (crudo && !fe) {
    com = [com, `fecha en el origen: ${crudo}`].filter(Boolean).join(' · ');
    sinFecha.push(`${doc || '(sin doc)'}: ${crudo}`);
  }

  if (movs.length === 0) {
    // La primera fila del Excel es el saldo inicial: no tiene cargo ni abono,
    // solo el saldo con que arranca la cuenta. En el Excel va negativo porque
    // es a favor; acá el disponible va en positivo.
    movs.push({ tipo: 'saldo_inicial', fecha: fe, documento: null, comentario: com || 'Saldo inicial', monto: -sAnt });
  }
  if (cargo) movs.push({ tipo: 'cargo', fecha: fe, documento: doc || null, comentario: com || null, monto: cargo });
  if (abono) movs.push({ tipo: 'abono', fecha: fe, documento: doc || null, comentario: com || null, monto: abono });
}

const disponible = movs.reduce(
  (s, m) => s + (m.tipo === 'cargo' ? -m.monto : m.monto),
  0,
);
const hasta = movs.map((m) => m.fecha).filter(Boolean).sort().at(-1);
const esperado = -anterior;   // el último S.Final del Excel, con el signo dado vuelta

console.log(`hoja: ${hoja}`);
console.log(`filas de movimiento leídas: ${filas.length}  ->  ${movs.length} movimientos`);
console.log(`  cargos: ${movs.filter((m) => m.tipo === 'cargo').length}`);
console.log(`  abonos: ${movs.filter((m) => m.tipo === 'abono').length}`);
console.log(`inconsistencias en la cadena de saldos: ${rotas}`);
if (sinFecha.length) {
  console.log(`fechas ilegibles en el origen (quedan sin fecha): ${sinFecha.length}`);
  for (const x of sinFecha) console.log(`  ${x}`);
}
console.log(`última fecha: ${hasta}`);
console.log(`DISPONIBLE calculado: ${disponible.toFixed(2)}`);
console.log(`DISPONIBLE del Excel:  ${esperado.toFixed(2)}`);

if (rotas > 0) {
  console.error('\nLa cadena de saldos del Excel no cierra. No se carga nada.');
  process.exit(1);
}
if (Math.abs(disponible - esperado) > 0.011) {
  console.error('\nEl disponible calculado no coincide con el del Excel. No se carga nada.');
  process.exit(1);
}
console.log('\n✓ La lectura cuadra con el estado de cuenta.');

if (!aplicar) {
  console.log('\n(simulación — volvé a correrlo con --aplicar para cargarlo)');
  process.exit(0);
}

// ── 2 · La cuenta ──────────────────────────────────────────────────────────
const aero = await sql(`select id from public.avn_aeronaves where matricula = ${lit(matricula)} and deleted_at is null`);
if (!aero.length) throw new Error(`no existe la aeronave ${matricula}`);
const aeronaveId = aero[0].id;

const cta = await sql(`select id from public.avn_fuel_cuentas where aeronave_id = '${aeronaveId}'`);
let cuentaId;
if (cta.length) {
  cuentaId = cta[0].id;
  const previos = await sql(`select count(*)::int as n from public.avn_fuel_movimientos where cuenta_id = '${cuentaId}' and deleted_at is null`);
  if (previos[0].n > 0 && !reemplazar) {
    console.error(`\nLa cuenta ya tiene ${previos[0].n} movimientos cargados. No se duplica nada.`);
    console.error('Si este archivo es un estado de cuenta más reciente, corré con --reemplazar.');
    process.exit(1);
  }
  if (previos[0].n > 0) {
    // Borrado físico y no en suave: esto es una copia de la contabilidad del
    // proveedor, no historia propia, y dejarla marcada obligaría a filtrarla
    // en cada consulta del saldo. Lo que pasó queda en `audit_log`.
    await sql(`delete from public.avn_fuel_movimientos where cuenta_id = '${cuentaId}'`);
    console.log(`historia anterior reemplazada: ${previos[0].n} movimientos fuera`);
  }
  // El corte se corre a la última fecha del archivo nuevo. De eso depende qué
  // registros de CEA entran al saldo, así que no puede quedar viejo.
  await sql(`update public.avn_fuel_cuentas set historico_hasta = ${lit(hasta)} where id = '${cuentaId}'`);
} else {
  const ins = await sql(`
    insert into public.avn_fuel_cuentas (aeronave_id, proveedor, proveedor_nit, moneda, deposito_objetivo, alerta_minimo, historico_hasta)
    values ('${aeronaveId}', 'AEROCLUB DE GUATEMALA GASOLINERA', null, 'GTQ', 25856.20, 8000, ${lit(hasta)})
    returning id`);
  cuentaId = ins[0].id;
  console.log(`cuenta creada: ${cuentaId}`);
}

// ── 3 · La historia ────────────────────────────────────────────────────────
// En lotes: 299 filas en un solo INSERT pasa del límite del endpoint.
const LOTE = 60;
for (let i = 0; i < movs.length; i += LOTE) {
  const trozo = movs.slice(i, i + LOTE);
  const values = trozo
    .map((m, k) => `('${cuentaId}', ${lit(m.tipo)}, ${lit(m.fecha)}, ${lit(m.documento)}, ${lit(m.comentario)}, ${m.monto}, ${i + k})`)
    .join(',\n    ');
  await sql(`
    insert into public.avn_fuel_movimientos (cuenta_id, tipo, fecha, documento, comentario, monto, orden)
    values\n    ${values}`);
  console.log(`  cargados ${Math.min(i + LOTE, movs.length)} / ${movs.length}`);
}

// ── 4 · Verificación contra la base ────────────────────────────────────────
const chk = await sql(`
  select round(sum(case when tipo = 'cargo' then -monto else monto end), 2) as disponible,
         count(*)::int as n
    from public.avn_fuel_movimientos
   where cuenta_id = '${cuentaId}' and deleted_at is null`);
console.log(`\nen la base: ${chk[0].n} movimientos, disponible ${chk[0].disponible}`);
if (Math.abs(Number(chk[0].disponible) - esperado) > 0.011) {
  console.error('El disponible en la base no coincide con el del Excel. Revisá.');
  process.exit(1);
}
console.log('✓ La base da el mismo disponible que el estado de cuenta.');
