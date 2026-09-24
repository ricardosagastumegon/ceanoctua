import { useRef, useState } from 'react';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { ItinerarioHojas } from './ItineraryModal';
import { armarLiquidacionCompleta, type ProgresoExport } from './viajes/liquidacion-pdf';
import { descargar } from '@/lib/descargar';
import { SERVICE_META } from './constants/serviceMeta';
import { fmtDate } from './utils';
import { useLiquidacion } from './viajes/liquidacion';
import logoColor from './arriaza-logo-color.png';
import type { AttViaje } from './viajes/api';

type Props = {
  open: boolean;
  onClose: () => void;
  viaje: AttViaje | null;
};

const NAVY = '#1e2a4a';
const GRIS = '#eef1f6';

const money = (v: number) => v.toFixed(2);

/**
 * Liquidación del viaje, para reporte financiero.
 *
 * Lleva un renglón por servicio -- sin detalle: no van pasajeros, ni
 * habitaciones, ni números de ticket -- y el consumo de cada tarjeta, que es
 * lo que se reporta al final.
 *
 * Las tres columnas de dinero son cargo, reintegro y neto, y no una sola. Un
 * servicio cancelado con devolución parcial costó la diferencia, y contra el
 * estado de cuenta hay que poder ver el cargo y el abono por separado.
 *
 * Va en azul marino y gris, como la reunión: es un documento financiero, no
 * una hoja de viaje.
 */
export function LiquidacionModal({ open, onClose, viaje }: Props) {
  const q = useLiquidacion(viaje?.id, open);
  const d = q.data;
  const toast = useToast();
  const hojaRef = useRef<HTMLDivElement>(null);
  const itinRef = useRef<HTMLDivElement>(null);
  const [progreso, setProgreso] = useState<ProgresoExport | null>(null);

  /** El documento único: la hoja de liquidación y el itinerario, para archivar. */
  async function exportar() {
    if (!viaje || !d) return;
    setProgreso({ paso: 'Preparando…', hechos: 0, total: 0 });
    try {
      const nodos = [hojaRef.current, itinRef.current].filter(Boolean) as HTMLElement[];
      const { blob } = await armarLiquidacionCompleta(nodos, setProgreso);
      descargar(blob, `Liquidacion ${viaje.trip_no ?? viaje.titulo}.pdf`);
      toast.success('Liquidación descargada.');
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setProgreso(null);
    }
  }
  const monedaUnica = d && d.monedas.length === 1 ? d.monedas[0] : '';
  const mezcla = !!d && d.monedas.length > 1;
  /** Con una sola moneda va en el encabezado; con varias, en cada renglón. */
  const sufijo = monedaUnica ? ` (${monedaUnica})` : '';
  const cifra = (v: number, m: string) => (monedaUnica ? money(v) : `${m} ${money(v)}`);

  if (!viaje) return null;

  return (
    <PrintableModal open={open} onClose={onClose} title={`Liquidación · ${viaje.titulo}`}>
      {/* El documento completo se arma aparte del botón de imprimir: este
          junta las confirmaciones, y eso el navegador no lo sabe hacer. */}
      <div className="no-print mb-3 flex items-center justify-end gap-3">
        {progreso && (
          <span className="text-[11px] font-semibold text-dark-3">
            {progreso.paso}
            {progreso.total > 0 ? ` (${progreso.hechos}/${progreso.total})` : ''}
          </span>
        )}
        <button
          type="button"
          onClick={() => void exportar()}
          disabled={!d || !!progreso}
          className="rounded-md px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50"
          style={{ backgroundColor: NAVY }}
        >
          {progreso ? 'Armando…' : '⬇ Descargar completa'}
        </button>
      </div>

      <article ref={hojaRef} style={{ fontFamily: 'Nunito, sans-serif', color: '#321201' }}>
        <header
          className="flex items-center justify-between px-8 py-5 text-white"
          style={{ background: `linear-gradient(135deg,#0d1526,${NAVY},#33456e)` }}
        >
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/55">
              Liquidación de viaje
            </div>
            <div className="font-heading text-2xl font-extrabold">{viaje.titulo}</div>
            <div className="mt-1 text-[12px] text-white/75">
              {viaje.trip_no ? `${viaje.trip_no} · ` : ''}
              {fmtDate(viaje.fecha_ini)} — {fmtDate(viaje.fecha_fin)}
            </div>
            {viaje.acompanantes && (
              <div className="mt-0.5 text-[12px] text-white/60">{viaje.acompanantes}</div>
            )}
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
            Este viaje todavía no tiene servicios con costo.
          </p>
        )}

        {d && d.renglones.length > 0 && (
          <>
            {mezcla && (
              <div className="mx-8 mt-4 rounded-md border border-rust bg-rust-l px-3 py-2 text-[11px] font-semibold text-rust">
                Este viaje mezcla {d.monedas.join(', ')}. Los totales están sumados sin
                convertir, así que léelos como referencia.
              </div>
            )}

            {/* Un renglón por servicio. Sin detalle, a propósito. */}
            <section className="px-8 py-5">
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: NAVY }}>
                Servicios del viaje · {d.renglones.length}
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ backgroundColor: GRIS, color: NAVY }} className="text-left">
                    <th className="w-[16%] px-2 py-1.5 font-extrabold">Servicio</th>
                    <th className="w-[26%] px-2 py-1.5 font-extrabold">Detalle</th>
                    <th className="whitespace-nowrap px-2 py-1.5 font-extrabold">Fecha</th>
                    <th className="w-[18%] px-2 py-1.5 font-extrabold">Pagado con</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Cargo{sufijo}</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Reintegro{sufijo}</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Neto{sufijo}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.renglones.map((r, i) => {
                    const meta = SERVICE_META[r.servicio];
                    const cancelado = r.estadoPago === 'CANCELADO';

                    return (
                      <tr
                        key={`${r.servicio}-${i}`}
                        className="border-b"
                        style={{ borderColor: GRIS, opacity: cancelado && r.neto === 0 ? 0.55 : 1 }}
                      >
                        {/* Sin icono: es un documento financiero, va limpio. */}
                        <td className="px-2 py-1.5 text-dark-2">{meta.label}</td>
                        <td className="px-2 py-1.5 text-dark">
                          {r.nombre}
                          {cancelado && (
                            <span className="ml-1 rounded bg-rust-l px-1 text-[9px] font-extrabold uppercase text-rust">
                              cancelado
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-dark-3">
                          {r.fecha ? fmtDate(r.fecha) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-dark-2">
                          {r.pagadoConCorto ?? <span className="text-rust">Sin forma de pago</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-dark">
                          {cifra(r.cargo, r.moneda)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right" style={{ color: r.reintegro > 0 ? '#8f3406' : '#9a8f86' }}>
                          {r.reintegro > 0 ? `− ${cifra(r.reintegro, r.moneda)}` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold" style={{ color: NAVY }}>
                          {cifra(r.neto, r.moneda)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {/* El consumo por tarjeta: a esto viene la hoja. */}
            <section className="px-8 pb-5">
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: NAVY }}>
                Consumo por tarjeta
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ backgroundColor: GRIS, color: NAVY }} className="text-left">
                    <th className="px-2 py-1.5 font-extrabold">Tarjeta</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Servicios</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Cargos{sufijo}</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Reintegros{sufijo}</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Neto{sufijo}</th>
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
                      <td className="px-2 py-1.5 text-right text-dark-3">{t.servicios}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-dark">
                        {money(t.cargos)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right" style={{ color: t.reintegros > 0 ? '#8f3406' : '#9a8f86' }}>
                        {t.reintegros > 0 ? `− ${money(t.reintegros)}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold" style={{ color: NAVY }}>
                        {money(t.neto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div
              className="flex items-center justify-between px-8 py-4 text-white"
              style={{ background: NAVY }}
            >
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[.18em] text-white/60">
                  Total del viaje
                </div>
                <div className="text-[11px] text-white/60">
                  Cargos {monedaUnica} {money(d.cargos)}
                  {d.reintegros > 0 ? ` · reintegros ${monedaUnica} ${money(d.reintegros)}` : ''}
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

      {/* Montado fuera de pantalla: hace falta en el DOM para capturarlo, pero
          no tiene por qué verse ni imprimirse con la hoja. */}
      <div
        aria-hidden
        className="no-print"
        style={{ position: 'fixed', left: '-10000px', top: 0, width: '820px' }}
      >
        <div ref={itinRef} style={{ background: '#ffffff', padding: '16px' }}>
          <ItinerarioHojas viaje={viaje} activo={open} />
        </div>
      </div>
    </PrintableModal>
  );
}
