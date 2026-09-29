import { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { fmtDate } from '@/modules/arriaza/utils';
import { VisorDocumento, type Visor } from '../VisorDocumento';
import { acento } from '../constants';
import type { Aeronave } from '../api';
import { AbonoFormModal } from './AbonoFormModal';
import { ReporteCuentaModal } from './ReporteCuentaModal';
import { useBorrarAbono, useEstadoCuenta } from './hooks';
import type { Abono } from './api';

const money = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AMBAR = '#b4460f';
const VERDE = '#2a6e24';

/**
 * Estado de cuenta del proveedor de combustible.
 *
 * No es crédito: es un depósito del que se consume y que se repone. El límite
 * de crédito del proveedor es 0.00, así que quedarse sin saldo es quedarse sin
 * fuel — y por eso el aviso de saldo bajo no es decorativo.
 *
 * El signo va al revés del Excel del proveedor, a propósito: él lleva el saldo
 * en negativo porque para él somos un pasivo. Acá **disponible en positivo**.
 */
export function EstadoCuentaSection({
  aeronave,
  canEdit,
}: {
  aeronave: Aeronave;
  canEdit: boolean;
}) {
  const col = acento(aeronave.acento);
  const q = useEstadoCuenta(aeronave.id);
  const borrar = useBorrarAbono(aeronave.id);
  const toast = useToast();
  const confirmar = useConfirm();

  const [abriendo, setAbriendo] = useState(false);
  const [editando, setEditando] = useState<Abono | null>(null);
  const [visor, setVisor] = useState<Visor | null>(null);
  const [verTodo, setVerTodo] = useState(false);
  // El rango del reporte. Arranca en el mes en curso, que es lo que se saca
  // casi siempre; el resto se pide cambiando las fechas.
  const [desde, setDesde] = useState(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [reporte, setReporte] = useState(false);

  const d = q.data;
  const atajos = useMemo(rangosRapidos, []);
  const moneda = d?.cuenta?.moneda ?? 'GTQ';

  // La historia son dos años; de entrada solo se muestra lo reciente.
  const visibles = useMemo(() => {
    const m = d?.movimientos ?? [];
    return verTodo ? [...m].reverse() : [...m].slice(-25).reverse();
  }, [d?.movimientos, verTodo]);

  async function quitarAbono(a: Abono) {
    const ok = await confirmar({
      title: 'Quitar reposición',
      message: (
        <>
          ¿Quitar la reposición de <b>{moneda} {money(Number(a.monto))}</b> del {fmtDate(a.fecha)}?
          Las facturas que cubría vuelven a quedar pendientes.
        </>
      ),
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync(a.id);
      toast.success('Reposición quitada.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  if (q.isLoading) return <p className="text-sm text-dark-3">Cargando el estado de cuenta…</p>;
  if (q.isError) {
    return (
      <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-sm text-rust">
        {describeError(q.error)}
      </div>
    );
  }
  if (!d?.cuenta) {
    return (
      <div className="rounded-card border border-sand bg-white p-5 text-sm text-dark-3 shadow-sm">
        Esta aeronave todavía no tiene cuenta con un proveedor de combustible.
      </div>
    );
  }

  const objetivo = d.cuenta.deposito_objetivo != null ? Number(d.cuenta.deposito_objetivo) : null;

  return (
    <div className="space-y-4">
      {/* Lo primero: cuánto queda. */}
      <div className="rounded-card p-5 text-white shadow-sm" style={{ background: col.grad }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/70">
              Depósito disponible
            </div>
            <div className="mt-1 font-heading text-4xl font-extrabold">
              {moneda} {money(d.disponible)}
            </div>
            <div className="mt-1 text-[12px] text-white/70">
              {d.cuenta.proveedor ?? 'Proveedor de combustible'}
            </div>
          </div>
          <div className="text-right text-[12px]">
            {objetivo != null && (
              <>
                <div className="text-white/70">
                  Depósito: <b className="text-white">{moneda} {money(objetivo)}</b>
                </div>
                {d.faltaReponer > 0.005 && (
                  <div className="mt-0.5 text-white/70">
                    Falta reponer: <b className="text-white">{moneda} {money(d.faltaReponer)}</b>
                  </div>
                )}
              </>
            )}
            <div className="mt-2 flex flex-wrap justify-end gap-3 text-[11px] text-white/60">
              <span>Consumido {moneda} {money(d.consumido)}</span>
              <span>Repuesto {moneda} {money(d.repuesto)}</span>
            </div>
          </div>
        </div>

        {/* Con límite de crédito en cero, esto para la operación. */}
        {d.bajo && (
          <div className="mt-3 rounded-md bg-white/20 px-3 py-2 text-[12px] font-semibold">
            ⚠ El disponible está por debajo del mínimo de {moneda}{' '}
            {money(Number(d.cuenta.alerta_minimo))} — unos cuatro o cinco días de abastecimiento.
            Hay que iniciar la reposición ahora: un pago tarda más o menos eso en procesarse.
          </div>
        )}
      </div>

      {/* Lo que está esperando reposición. */}
      {d.pendientes.length > 0 && (
        <div className="rounded-card border px-4 py-3 shadow-sm"
          style={{ borderColor: `${col.solid}55`, backgroundColor: col.light }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider"
                style={{ color: col.dark }}>
                Facturas pendientes de reponer · {d.pendientes.length}
              </span>
              <p className="text-[11px] text-dark-2">
                {moneda} {money(d.pendientes.reduce((s, p) => s + p.total, 0))} en total.
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => { setEditando(null); setAbriendo(true); }}
                className="rounded-md px-3 py-1.5 text-[11px] font-extrabold text-white hover:opacity-90"
                style={{ backgroundColor: col.solid }}
              >
                ＋ Registrar reposición
              </button>
            )}
          </div>
        </div>
      )}

      {/* El reporte por período: es lo que se le manda a contabilidad. */}
      <div className="rounded-card border border-sand bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-dark-3">
                Reporte del período
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                  className="rounded-md border border-sand px-2 py-1.5 text-sm text-dark focus:border-teal focus:outline-none" />
                <span className="text-dark-3">→</span>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                  className="rounded-md border border-sand px-2 py-1.5 text-sm text-dark focus:border-teal focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-1">
              {atajos.map(([rotulo, d, h]) => (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => { setDesde(d); setHasta(h); }}
                  className="rounded-md border border-sand px-2 py-1 text-[11px] font-semibold text-dark-2 hover:bg-sand-l"
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReporte(true)}
            disabled={!desde || !hasta || desde > hasta}
            className="rounded-md px-3 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: col.solid }}
          >
            Generar reporte
          </button>
        </div>
        {desde > hasta && (
          <p className="mt-2 text-[11px] text-rust">La fecha inicial es posterior a la final.</p>
        )}
      </div>

      <div className="rounded-card border border-sand bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider"
              style={{ color: col.dark }}>
              Movimientos · {d.movimientos.length}
            </h2>
            <p className="mt-0.5 text-[11px] text-dark-3">
              Las facturas consumen el depósito; las reposiciones lo recargan.
              {d.cuenta.historico_hasta && (
                <> Hasta el {fmtDate(d.cuenta.historico_hasta)} viene del estado de cuenta de {d.cuenta.proveedor ?? 'el proveedor'}.</>
              )}
            </p>
          </div>
          {canEdit && d.pendientes.length === 0 && (
            <button
              type="button"
              onClick={() => { setEditando(null); setAbriendo(true); }}
              className="rounded-md px-3 py-2 text-xs font-extrabold text-white hover:opacity-90"
              style={{ backgroundColor: col.solid }}
            >
              ＋ Registrar reposición
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left" style={{ backgroundColor: col.light, color: col.dark }}>
                <th className="whitespace-nowrap px-2 py-2 font-extrabold">Fecha</th>
                <th className="px-2 py-2 font-extrabold">Documento</th>
                <th className="px-2 py-2 font-extrabold">Comentario</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-extrabold">Consumo</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-extrabold">Reposición</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-extrabold">Disponible</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={m.clave} className="border-b border-sand">
                  <td className="whitespace-nowrap px-2 py-1.5 text-dark-2">
                    {m.fecha ? fmtDate(m.fecha) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px] text-dark">
                    {m.documento ?? (m.tipo === 'saldo_inicial' ? 'Saldo inicial' : '—')}
                    {m.origen !== 'historico' && (
                      <span className="ml-1 rounded px-1 font-sans text-[9px] font-extrabold uppercase"
                        style={{ backgroundColor: col.light, color: col.dark }}>
                        CEA
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-dark-3">{m.comentario ?? '—'}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right" style={{ color: AMBAR }}>
                    {m.cargo ? money(m.cargo) : ''}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right" style={{ color: VERDE }}>
                    {m.abono ? money(m.abono) : ''}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold"
                    style={{ color: m.saldo < 0 ? AMBAR : col.dark }}>
                    {money(m.saldo)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {m.abonoRow && canEdit && (
                      <>
                        {m.abonoRow.comprobante_path && (
                          <button
                            type="button"
                            onClick={() => setVisor({
                              tipo: 'archivo',
                              path: m.abonoRow?.comprobante_path as string,
                              titulo: `Comprobante · ${m.abonoRow?.documento ?? fmtDate(m.abonoRow?.fecha)}`,
                              nombre: m.abonoRow?.comprobante_nombre ?? null,
                            })}
                            title="Ver el comprobante de pago"
                            className="px-1 text-[12px] opacity-50 hover:opacity-100"
                          >
                            📎
                          </button>
                        )}
                        <button type="button" title="Editar"
                          onClick={() => { setEditando(m.abonoRow ?? null); setAbriendo(true); }}
                          className="px-1 text-[12px] opacity-50 hover:opacity-100">✏️</button>
                        <button type="button" title="Quitar"
                          onClick={() => void quitarAbono(m.abonoRow as Abono)}
                          className="px-1 text-[12px] opacity-50 hover:opacity-100">🗑</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!verTodo && d.movimientos.length > 25 && (
          <button
            type="button"
            onClick={() => setVerTodo(true)}
            className="mt-3 rounded-md border border-sand px-3 py-1.5 text-[11px] font-semibold text-dark-2 hover:bg-sand-l"
          >
            Ver los {d.movimientos.length} movimientos
          </button>
        )}
      </div>

      {abriendo && (
        <AbonoFormModal
          aeronave={aeronave}
          cuentaId={d.cuenta.id}
          moneda={moneda}
          pendientes={d.pendientes}
          editando={editando}
          onClose={() => { setAbriendo(false); setEditando(null); }}
        />
      )}

      {reporte && (
        <ReporteCuentaModal
          aeronave={aeronave}
          estado={d}
          desde={desde}
          hasta={hasta}
          onClose={() => setReporte(false)}
        />
      )}

      <VisorDocumento visor={visor} onClose={() => setVisor(null)} />
    </div>
  );
}

/** Los rangos que se piden siempre: este mes, el pasado y el año. */
function rangosRapidos(): [string, string, string][] {
  const h = new Date();
  const iso = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return [
    ['Este mes', iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(new Date(h.getFullYear(), h.getMonth() + 1, 0))],
    ['Mes pasado', iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), iso(new Date(h.getFullYear(), h.getMonth(), 0))],
    [`${h.getFullYear()}`, `${h.getFullYear()}-01-01`, `${h.getFullYear()}-12-31`],
    ['Todo', '2000-01-01', iso(h)],
  ];
}
