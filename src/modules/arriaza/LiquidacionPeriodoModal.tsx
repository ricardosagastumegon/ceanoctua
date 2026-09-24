import { useRef, useState } from 'react';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { armarLiquidacionCompleta, type ProgresoExport } from './viajes/liquidacion-pdf';
import { descargar } from '@/lib/descargar';
import {
  anioActual,
  mesActual,
  mesPasado,
  useLiquidacionPeriodo,
  type RenglonPeriodo,
} from './viajes/liquidacion-periodo';
import { SERVICE_META } from './constants/serviceMeta';
import { fmtDate } from './utils';
import logoColor from './arriaza-logo-color.png';

type Props = { open: boolean; onClose: () => void };

const NAVY = '#1e2a4a';
const GRIS = '#eef1f6';
const RUST = '#8f3406';

const money = (v: number) => v.toFixed(2);

/**
 * Los viajes que tocó una tarjeta, resumidos. Un mes movido puede traer
 * quince, y la celda no puede volverse un muro de texto: el detalle completo
 * está abajo, viaje por viaje.
 */
function listaViajes(viajes: string[]): string {
  if (viajes.length <= 3) return viajes.join(' · ');
  return `${viajes.slice(0, 3).join(' · ')} y ${viajes.length - 3} más`;
}

/**
 * Liquidación por período: todos los viajes, agrupada por tarjeta.
 *
 * La liquidación del viaje responde "cuánto costó este viaje". Esta responde
 * "cuánto hay que pagarle a esta tarjeta este mes", que es como llegan los
 * estados de cuenta y como se pagan de verdad.
 *
 * El resumen va arriba porque es lo primero que se mira. El detalle por
 * tarjeta va abajo, para cuadrar renglón por renglón contra el estado de
 * cuenta, y cada renglón dice de qué viaje viene.
 *
 * Mismo azul marino y gris que la liquidación del viaje, y sin íconos: es el
 * mismo tipo de documento y se archiva igual.
 */
export function LiquidacionPeriodoModal({ open, onClose }: Props) {
  const [rango, setRango] = useState(mesActual);
  const q = useLiquidacionPeriodo(rango.desde, rango.hasta, open);
  const d = q.data;
  const toast = useToast();
  const hojaRef = useRef<HTMLDivElement>(null);
  const [progreso, setProgreso] = useState<ProgresoExport | null>(null);

  const monedaUnica = d && d.monedas.length === 1 ? d.monedas[0] : '';
  const mezcla = !!d && d.monedas.length > 1;
  const sufijo = monedaUnica ? ` (${monedaUnica})` : '';
  const cifra = (v: number, m: string) => (monedaUnica ? money(v) : `${m} ${money(v)}`);

  const invertido = !!rango.desde && !!rango.hasta && rango.desde > rango.hasta;

  async function exportar() {
    if (!hojaRef.current || !d) return;
    setProgreso({ paso: 'Preparando…', hechos: 0, total: 0 });
    try {
      const { blob } = await armarLiquidacionCompleta([hojaRef.current], setProgreso);
      descargar(blob, `Liquidacion ${rango.desde} a ${rango.hasta}.pdf`);
      toast.success('Liquidación descargada.');
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setProgreso(null);
    }
  }

  return (
    <PrintableModal open={open} onClose={onClose} title="Liquidación por período">
      {/* Los controles no van en el documento. */}
      <div className="no-print mb-3 flex flex-wrap items-end gap-3 rounded-md bg-sand-l px-3 py-3">
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-dark-2">
          Desde
          <input
            type="date"
            value={rango.desde}
            onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
            className="mt-1 block rounded-md border border-sand bg-white px-2 py-1.5 text-sm text-dark focus:border-teal focus:outline-none"
          />
        </label>
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-dark-2">
          Hasta
          <input
            type="date"
            value={rango.hasta}
            onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
            className="mt-1 block rounded-md border border-sand bg-white px-2 py-1.5 text-sm text-dark focus:border-teal focus:outline-none"
          />
        </label>

        <div className="flex gap-1.5">
          {([
            ['Mes actual', mesActual],
            ['Mes pasado', mesPasado],
            ['Año', anioActual],
          ] as const).map(([rotulo, fn]) => (
            <button
              key={rotulo}
              type="button"
              onClick={() => setRango(fn())}
              className="rounded-md border border-sand bg-white px-2.5 py-1.5 text-[11px] font-semibold text-dark-2 hover:border-teal hover:text-teal"
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {progreso && (
            <span className="text-[11px] font-semibold text-dark-3">
              {progreso.paso}
              {progreso.total > 0 ? ` (${progreso.hechos}/${progreso.total})` : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => void exportar()}
            disabled={!d || !!progreso || !d.renglones.length}
            className="rounded-md px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50"
            style={{ backgroundColor: NAVY }}
          >
            {progreso ? 'Armando…' : '⬇ Descargar'}
          </button>
        </div>
      </div>

      {invertido && (
        <div className="no-print mb-3 rounded-md border border-rust bg-rust-l px-3 py-2 text-[11px] font-semibold text-rust">
          La fecha de inicio es posterior a la del final, así que el período está vacío.
        </div>
      )}

      <article ref={hojaRef} style={{ fontFamily: 'Nunito, sans-serif', color: '#321201' }}>
        <header
          className="flex items-center justify-between px-8 py-5 text-white"
          style={{ background: `linear-gradient(135deg,#0d1526,${NAVY},#33456e)` }}
        >
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/55">
              Liquidación por período
            </div>
            <div className="font-heading text-2xl font-extrabold">
              {fmtDate(rango.desde)} — {fmtDate(rango.hasta)}
            </div>
            <div className="mt-1 text-[12px] text-white/75">
              Consumo por tarjeta · todos los viajes
            </div>
          </div>
          <img
            src={logoColor}
            alt="Arriaza Tour &amp; Travel"
            style={{ height: '42px', filter: 'brightness(0) invert(1)' }}
          />
        </header>

        {q.isLoading && <p className="px-8 py-6 text-sm text-dark-3">Armando la liquidación…</p>}

        {q.isError && (
          <div className="mx-8 my-6 rounded-md border border-rust bg-rust-l px-4 py-3 text-sm text-rust">
            <b>No se pudo armar la liquidación.</b>
            <div className="mt-1 text-xs">{describeError(q.error)}</div>
            <button
              type="button"
              onClick={() => void q.refetch()}
              className="mt-2 rounded-md border border-rust px-3 py-1 text-xs font-semibold"
            >
              Reintentar
            </button>
          </div>
        )}

        {d && d.renglones.length === 0 && (
          <p className="px-8 py-6 text-sm italic text-dark-3">
            No hay servicios con costo en este período.
          </p>
        )}

        {d && d.renglones.length > 0 && (
          <>
            {mezcla && (
              <div className="mx-8 mt-4 rounded-md border border-rust bg-rust-l px-3 py-2 text-[11px] font-semibold text-rust">
                Este período mezcla {d.monedas.join(', ')}. Los totales están sumados sin
                convertir, así que léelos como referencia.
              </div>
            )}

            {/* Lo primero que se mira: cuánto se le debe a cada tarjeta. */}
            <section className="px-8 py-5">
              <div
                className="mb-2 text-[11px] font-extrabold uppercase tracking-wider"
                style={{ color: NAVY }}
              >
                Resumen por tarjeta
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ backgroundColor: GRIS, color: NAVY }} className="text-left">
                    <th className="px-2 py-1.5 font-extrabold">Tarjeta</th>
                    <th className="px-2 py-1.5 font-extrabold">Viajes</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">
                      Servicios
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">
                      Cargos{sufijo}
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">
                      Reintegros{sufijo}
                    </th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">
                      Neto{sufijo}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.tarjetas.map((t, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: GRIS }}>
                      <td className="px-2 py-1.5">
                        <span className={t.identificada ? 'text-dark' : 'text-rust'}>
                          {t.etiqueta}
                        </span>
                        {!t.identificada && (
                          <span className="ml-1 text-[9px] font-extrabold uppercase text-rust">
                            sin identificar
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-dark-3">{listaViajes(t.viajes)}</td>
                      <td className="px-2 py-1.5 text-right text-dark-3">{t.renglones.length}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-dark">
                        {money(t.cargos)}
                      </td>
                      <td
                        className="whitespace-nowrap px-2 py-1.5 text-right"
                        style={{ color: t.reintegros > 0 ? RUST : '#9a8f86' }}
                      >
                        {t.reintegros > 0 ? `− ${money(t.reintegros)}` : '—'}
                      </td>
                      <td
                        className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold"
                        style={{ color: NAVY }}
                      >
                        {money(t.neto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* El detalle, para cuadrar contra el estado de cuenta. */}
            {d.tarjetas.map((t, i) => (
              <section key={i} className="px-8 pb-5" style={{ breakInside: 'avoid' }}>
                <div
                  className="mb-2 flex items-baseline justify-between border-b pb-1"
                  style={{ borderColor: NAVY }}
                >
                  <div
                    className="text-[11px] font-extrabold uppercase tracking-wider"
                    style={{ color: t.identificada ? NAVY : RUST }}
                  >
                    {t.etiqueta}
                  </div>
                  <div className="text-[11px] font-extrabold" style={{ color: NAVY }}>
                    Neto {monedaUnica} {money(t.neto)}
                  </div>
                </div>
                <TablaRenglones renglones={t.renglones} cifra={cifra} sufijo={sufijo} />
              </section>
            ))}

            {/* Lo que no cabe en ningún período. Se muestra siempre: si se
                filtrara sin más, desaparecería de todos los reportes y se
                pagaría de menos sin enterarse. */}
            {d.sinFecha.length > 0 && (
              <section className="px-8 pb-5" style={{ breakInside: 'avoid' }}>
                <div
                  className="mb-2 rounded-md px-3 py-2 text-[11px] font-semibold"
                  style={{ backgroundColor: '#f7e6de', color: RUST }}
                >
                  <b>{d.sinFecha.length} servicio{d.sinFecha.length > 1 ? 's' : ''} sin fecha.</b>{' '}
                  No tienen fecha de cargo ni fecha propia, así que no entran en este período ni en
                  ningún otro, y no están sumados abajo. Captúrales la fecha para que aparezcan.
                </div>
                <TablaRenglones renglones={d.sinFecha} cifra={cifra} sufijo={sufijo} conTarjeta />
              </section>
            )}

            <div
              className="flex items-center justify-between px-8 py-4 text-white"
              style={{ background: NAVY }}
            >
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[.18em] text-white/60">
                  Total del período
                </div>
                <div className="text-[11px] text-white/60">
                  Cargos {monedaUnica} {money(d.cargos)}
                  {d.reintegros > 0
                    ? ` · reintegros ${monedaUnica} ${money(d.reintegros)}`
                    : ''}
                  {' · '}
                  {d.renglones.length} servicio{d.renglones.length > 1 ? 's' : ''} en{' '}
                  {d.tarjetas.length} tarjeta{d.tarjetas.length > 1 ? 's' : ''}
                </div>
              </div>
              <div className="font-heading text-2xl font-extrabold">
                {monedaUnica} {money(d.neto)}
              </div>
            </div>
          </>
        )}

        <div
          className="px-8 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/40"
          style={{ backgroundColor: '#131c31' }}
        >
          Arriaza Tour &amp; Travel · Liquidación para reporte financiero
        </div>
      </article>
    </PrintableModal>
  );
}

/**
 * El detalle de renglones. Es el mismo cuerpo bajo cada tarjeta y bajo el
 * bloque de los que no tienen fecha; ahí sí hace falta la columna de tarjeta,
 * porque ese bloque no está agrupado por una.
 */
function TablaRenglones({
  renglones,
  cifra,
  sufijo,
  conTarjeta = false,
}: {
  renglones: RenglonPeriodo[];
  cifra: (v: number, m: string) => string;
  sufijo: string;
  conTarjeta?: boolean;
}) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr style={{ backgroundColor: GRIS, color: NAVY }} className="text-left">
          <th className="w-[11%] whitespace-nowrap px-2 py-1.5 font-extrabold">Fecha</th>
          <th className="w-[22%] px-2 py-1.5 font-extrabold">Viaje</th>
          <th className="w-[13%] px-2 py-1.5 font-extrabold">Servicio</th>
          <th className="px-2 py-1.5 font-extrabold">Detalle</th>
          {conTarjeta && <th className="w-[13%] px-2 py-1.5 font-extrabold">Pagado con</th>}
          <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Cargo{sufijo}</th>
          <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">
            Reintegro{sufijo}
          </th>
          <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Neto{sufijo}</th>
        </tr>
      </thead>
      <tbody>
        {renglones.map((r, i) => {
          const cancelado = r.estadoPago === 'CANCELADO';
          return (
            <tr
              key={`${r.servicio}-${i}`}
              className="border-b"
              style={{ borderColor: GRIS, opacity: cancelado && r.neto === 0 ? 0.55 : 1 }}
            >
              <td className="whitespace-nowrap px-2 py-1.5 text-dark-3">
                {fmtDate(r.fechaEfectiva)}
                {/* Si el cargo cayó en otra fecha que el servicio, se avisa:
                    es la razón por la que el renglón está en este mes. */}
                {r.fechaCargo && r.fecha && r.fechaCargo !== r.fecha && (
                  <div className="text-[9px] text-dark-3/70">servicio {fmtDate(r.fecha)}</div>
                )}
              </td>
              <td className="px-2 py-1.5 text-dark-2">
                {r.viajeTitulo}
                {r.viajeNo && (
                  <div className="whitespace-nowrap text-[9px] text-dark-3">{r.viajeNo}</div>
                )}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-dark-2">
                {SERVICE_META[r.servicio].label}
              </td>
              <td className="px-2 py-1.5 text-dark">
                {r.nombre}
                {cancelado && (
                  <span className="ml-1 rounded bg-rust-l px-1 text-[9px] font-extrabold uppercase text-rust">
                    cancelado
                  </span>
                )}
              </td>
              {conTarjeta && (
                <td className="px-2 py-1.5 text-dark-2">
                  {r.pagadoConCorto ?? <span className="text-rust">Sin forma de pago</span>}
                </td>
              )}
              <td className="whitespace-nowrap px-2 py-1.5 text-right text-dark">
                {cifra(r.cargo, r.moneda)}
              </td>
              <td
                className="whitespace-nowrap px-2 py-1.5 text-right"
                style={{ color: r.reintegro > 0 ? RUST : '#9a8f86' }}
              >
                {r.reintegro > 0 ? `− ${cifra(r.reintegro, r.moneda)}` : '—'}
              </td>
              <td
                className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold"
                style={{ color: NAVY }}
              >
                {cifra(r.neto, r.moneda)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
