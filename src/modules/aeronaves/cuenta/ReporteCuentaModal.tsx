import { useMemo, useRef, useState } from 'react';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { descargar } from '@/lib/descargar';
import { armarPdfDeHojas, type ProgresoExport } from '@/lib/pdf-hojas';
import { fmtDate } from '@/modules/arriaza/utils';
import { acento } from '../constants';
import type { Aeronave } from '../api';
import type { EstadoCuenta, MovimientoCuenta } from './api';

const money = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AMBAR = '#b4460f';
const VERDE = '#2a6e24';

/** Cuántos movimientos caben en una hoja carta con el encabezado. */
const POR_HOJA = 28;

type Props = {
  aeronave: Aeronave;
  estado: EstadoCuenta;
  desde: string;
  hasta: string;
  onClose: () => void;
};

/**
 * El estado de cuenta de un período, para imprimir o descargar.
 *
 * Se parte en hojas por programa y no se deja al navegador, porque el mismo
 * corte sirve para las dos salidas: al imprimir cada bloque arranca en hoja
 * nueva, y al descargar cada bloque es una página del PDF. Si se dejara
 * fluir, el PDF descargado saldría como una sola imagen larguísima aplastada
 * en una página.
 *
 * Un reporte por período necesita el **saldo al inicio**: sin él las columnas
 * de saldo no significan nada, porque el depósito no arranca en cero el día
 * que empieza el rango.
 */
export function ReporteCuentaModal({ aeronave, estado, desde, hasta, onClose }: Props) {
  const col = acento(aeronave.acento);
  const toast = useToast();
  const hojasRef = useRef<HTMLDivElement>(null);
  const [progreso, setProgreso] = useState<ProgresoExport | null>(null);

  const moneda = estado.cuenta?.moneda ?? 'GTQ';

  const datos = useMemo(() => {
    const todos = estado.movimientos;

    // El período es un TRAMO del libro, no un filtro por fecha.
    //
    // Las fechas marcan dónde empieza y dónde termina, pero lo que va en medio
    // entra completo, tenga fecha o no. Filtrar movimiento por movimiento
    // dejaba fuera los que el proveedor mandó sin fecha —los dos anticipos del
    // cierre, la factura con la fecha corrupta— y entonces las columnas no
    // cerraban: saldo inicial + repuesto − consumido no daba el saldo final.
    // Un reporte de dinero cuyas columnas no suman no sirve, aunque lleve una
    // nota al pie explicándolo.
    const enRango = todos
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => !!m.fecha && m.fecha >= desde && m.fecha <= hasta)
      .map(({ i }) => i);

    if (enRango.length === 0) {
      return { dentro: [], saldoInicial: 0, consumido: 0, repuesto: 0, saldoFinal: 0, sinFecha: 0 };
    }

    const primero = enRango[0];
    const ultimo = enRango[enRango.length - 1];
    const dentro = todos.slice(primero, ultimo + 1);

    return {
      dentro,
      // El arrastre: el saldo justo antes del primer movimiento del tramo.
      saldoInicial: primero > 0 ? todos[primero - 1].saldo : 0,
      consumido: dentro.reduce((s, m) => s + m.cargo, 0),
      repuesto: dentro.reduce((s, m) => s + m.abono, 0),
      saldoFinal: dentro[dentro.length - 1].saldo,
      // Los que entraron por posición aunque el proveedor no les puso fecha.
      sinFecha: dentro.filter((m) => !m.fecha).length,
    };
  }, [estado.movimientos, desde, hasta]);

  const bloques = useMemo(() => {
    const out: MovimientoCuenta[][] = [];
    for (let i = 0; i < datos.dentro.length; i += POR_HOJA) {
      out.push(datos.dentro.slice(i, i + POR_HOJA));
    }
    return out.length ? out : [[]];
  }, [datos.dentro]);

  const nombre = `Estado de cuenta ${aeronave.matricula} ${desde} a ${hasta}`;

  async function bajarPdf() {
    const nodos = [...(hojasRef.current?.querySelectorAll<HTMLElement>('[data-hoja]') ?? [])];
    if (!nodos.length) return;
    setProgreso({ paso: 'Preparando…', hechos: 0, total: nodos.length });
    try {
      const { blob } = await armarPdfDeHojas(nodos, setProgreso);
      descargar(blob, `${nombre}.pdf`);
      toast.success('Reporte descargado.');
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setProgreso(null);
    }
  }

  /**
   * El mismo reporte como hoja de cálculo.
   *
   * Va plano —una fila por movimiento, sin celdas combinadas ni sub-
   * encabezados— porque el punto de bajarlo a Excel es poder filtrarlo y
   * sumarlo, y eso se rompe con cualquier adorno.
   */
  async function bajarExcel() {
    try {
      const XLSX = await import('xlsx');
      // Redondeado antes de escribir: el saldo corriente arrastra el ruido del
      // punto flotante y en una celda queda un 22766.699999999997 que después
      // ensucia cualquier suma que se haga encima.
      const q = (v: number) => Math.round(v * 100) / 100;
      const filas = [
        { Fecha: '', Documento: '', Comentario: 'Saldo al inicio del período', Consumo: '', Reposición: '', Disponible: q(datos.saldoInicial) },
        ...datos.dentro.map((m) => ({
          Fecha: m.fecha ?? '',
          Documento: m.documento ?? '',
          Comentario: m.comentario ?? '',
          Consumo: m.cargo ? q(m.cargo) : '',
          'Reposición': m.abono ? q(m.abono) : '',
          Disponible: q(m.saldo),
          Origen: m.origen === 'historico' ? 'Estado de cuenta' : 'CEA',
        })),
        { Fecha: '', Documento: '', Comentario: 'Totales del período', Consumo: q(datos.consumido), 'Reposición': q(datos.repuesto), Disponible: q(datos.saldoFinal) },
      ];
      const ws = XLSX.utils.json_to_sheet(filas);
      ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 42 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Estado de cuenta');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      descargar(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `${nombre}.xlsx`,
      );
      toast.success('Reporte descargado.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <PrintableModal
      open
      onClose={onClose}
      title={`Estado de cuenta · ${aeronave.matricula}`}
    >
      {/* La barra va dentro y con `no-print`, como la de la liquidación: el
          modal imprime lo que tiene adentro y los botones no son parte del
          documento. */}
      <div className="no-print flex flex-wrap justify-end gap-2 border-b border-sand px-6 py-3">
        <button
          type="button"
          onClick={() => void bajarPdf()}
          disabled={!!progreso}
          className="rounded-md px-3 py-1.5 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: col.solid }}
        >
          {progreso ? progreso.paso : '⬇ Descargar PDF'}
        </button>
        <button
          type="button"
          onClick={() => void bajarExcel()}
          className="rounded-md border border-sand px-3 py-1.5 text-xs font-extrabold text-dark-2 hover:bg-sand-l"
        >
          ⬇ Descargar Excel
        </button>
      </div>

      <div ref={hojasRef}>
        {bloques.map((filas, i) => (
          <article
            key={i}
            data-hoja
            className={`bg-white ${i > 0 ? 'salto-pagina mt-8 border-t-4 border-dashed border-sand pt-8' : ''}`}
          >
            <header className="px-8 py-5 text-white" style={{ background: col.grad }}>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/70">
                    Estado de cuenta · combustible
                  </div>
                  <div className="mt-1 font-heading text-2xl font-extrabold">
                    {estado.cuenta?.proveedor ?? 'Proveedor'}
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-white/80">
                    {fmtDate(desde)} — {fmtDate(hasta)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-heading text-xl font-extrabold">{aeronave.matricula}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                    {aeronave.nombre ?? ''}
                  </div>
                  {bloques.length > 1 && (
                    <div className="mt-1 text-[10px] text-white/60">
                      Hoja {i + 1} de {bloques.length}
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* El arrastre va en la primera hoja: es lo que da sentido a la
                columna de saldo. */}
            {i === 0 && (
              <section className="grid grid-cols-4 gap-3 px-8 py-4">
                {[
                  { r: 'Saldo al inicio', v: datos.saldoInicial, c: col.dark },
                  { r: 'Consumido', v: datos.consumido, c: AMBAR },
                  { r: 'Repuesto', v: datos.repuesto, c: VERDE },
                  { r: 'Saldo al final', v: datos.saldoFinal, c: col.dark },
                ].map((k) => (
                  <div key={k.r} className="rounded-lg border px-3 py-2 text-center"
                    style={{ borderColor: col.solid }}>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">
                      {k.r}
                    </div>
                    <div className="font-heading text-sm font-extrabold" style={{ color: k.c }}>
                      {moneda} {money(k.v)}
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className={`px-8 ${i === 0 ? '' : 'pt-4'} pb-5`}>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left" style={{ backgroundColor: col.light, color: col.dark }}>
                    <th className="whitespace-nowrap px-2 py-1.5 font-extrabold">Fecha</th>
                    <th className="px-2 py-1.5 font-extrabold">Documento</th>
                    <th className="px-2 py-1.5 font-extrabold">Comentario</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Consumo</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Reposición</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold">Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-3 text-center text-[11px] italic text-dark-3">
                        No hay movimientos en este período.
                      </td>
                    </tr>
                  )}
                  {filas.map((m, k) => (
                    <tr key={m.clave} style={{ backgroundColor: k % 2 ? '#ffffff' : 'rgba(0,0,0,.02)' }}>
                      <td className="whitespace-nowrap px-2 py-1 text-dark-2">{fmtDate(m.fecha)}</td>
                      <td className="whitespace-nowrap px-2 py-1 font-mono text-dark">
                        {m.documento ?? (m.tipo === 'saldo_inicial' ? 'Saldo inicial' : '—')}
                      </td>
                      <td className="px-2 py-1 text-dark-3">{m.comentario ?? ''}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-right" style={{ color: AMBAR }}>
                        {m.cargo ? money(m.cargo) : ''}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-right" style={{ color: VERDE }}>
                        {m.abono ? money(m.abono) : ''}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-right font-extrabold"
                        style={{ color: m.saldo < 0 ? AMBAR : col.dark }}>
                        {money(m.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* El cierre solo en la última hoja. */}
            {i === bloques.length - 1 && (
              <>
                <footer className="flex items-center justify-between px-8 py-4 text-white"
                  style={{ background: col.grad }}>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                      Disponible al cierre del período
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/60">
                      {datos.dentro.length} movimiento{datos.dentro.length === 1 ? '' : 's'}
                      {datos.sinFecha > 0 && (
                        <> · incluye {datos.sinFecha} sin fecha en el estado de cuenta del proveedor</>
                      )}
                    </div>
                  </div>
                  <div className="font-heading text-2xl font-extrabold">
                    {moneda} {money(datos.saldoFinal)}
                  </div>
                </footer>
                <div className="px-8 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/40"
                  style={{ backgroundColor: col.dark }}>
                  CEA · Estado de cuenta de combustible · Documento de uso interno
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </PrintableModal>
  );
}
