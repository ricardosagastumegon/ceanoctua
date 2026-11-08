import { Fragment, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { DocumentAttachment } from '@/components/ui/DocumentAttachment';
import { describeError } from '@/modules/admin/hooks';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { parseNumero } from '@/lib/money';
import {
  CATEGORIAS, CATEGORIA_LABEL, ESTADO_COLOR, MEDIO_LABEL,
  type Gasto, type LiquidacionFila,
} from './api';
import {
  useActualizarLiquidacion, useAdjuntos, useBorrarGasto, useCerrar, useGastos,
  useReabrir,
} from './hooks';
import { GastoFormModal } from './GastoFormModal';
import { LiquidacionPrintable } from './LiquidacionPrintable';

function q(n: number | null | undefined): string {
  return `Q ${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function d(n: number | null | undefined): string {
  return `$ ${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * La hoja de una liquidación: se llena conforme van saliendo los gastos.
 *
 * Mientras es borrador se edita; al cerrarla se congela --y cerrar es lo que
 * exige los documentos--. El botón de imprimir saca el formato oficial, que
 * es el mismo que ve quien la autoriza.
 */
export function LiquidacionDetalle({
  liquidacion,
  canEdit,
  onClose,
}: {
  liquidacion: LiquidacionFila;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const gastosQ = useGastos(liquidacion.id);
  const gastos = useMemo(() => gastosQ.data ?? [], [gastosQ.data]);
  const adjuntos = useAdjuntos(liquidacion.id, gastos.map((g) => g.id));
  const actualizar = useActualizarLiquidacion(liquidacion.id);
  const borrarGasto = useBorrarGasto(liquidacion.id);
  const cerrar = useCerrar(liquidacion.id);
  const reabrir = useReabrir(liquidacion.id);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [imprimir, setImprimir] = useState(false);
  const [verAdjuntos, setVerAdjuntos] = useState<Gasto | null>(null);
  const [editarTc, setEditarTc] = useState(false);

  const abierta = liquidacion.estado === 'Borrador';
  const puedeEditar = canEdit && abierta;
  const esAdmin = profile?.rol === 'admin';

  // Qué falta para poder cerrar. Se dice ANTES de intentarlo: que el botón
  // explique por qué no, en vez de reventar con un error al pulsarlo.
  const faltantes = useMemo(() => {
    const mapa = adjuntos.data;
    if (!mapa) return [];
    return gastos.filter((g) => !g.sin_documento && !(mapa.get(g.id) ?? 0));
  }, [gastos, adjuntos.data]);

  async function quitar(g: Gasto) {
    const ok = await confirmar({
      title: 'Quitar gasto',
      message: <>¿Quitar <b>{g.proveedor}</b> de {q(g.monto_gtq)}? Los totales se recalculan solos.</>,
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    try {
      await borrarGasto.mutateAsync(g.id);
      toast.success('Gasto quitado.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function cerrarla() {
    const ok = await confirmar({
      title: 'Cerrar liquidación',
      message: (
        <>
          Se congela <b>{liquidacion.serial}</b> con {gastos.length} gastos y un reembolso de{' '}
          <b>{q(liquidacion.piloto_gtq)}</b> al piloto. Después ya no se le pueden agregar ni
          cambiar gastos.
        </>
      ),
      confirmLabel: 'Cerrar',
    });
    if (!ok) return;
    try {
      await cerrar.mutateAsync();
      toast.success('Liquidación cerrada.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function reabrirla() {
    const ok = await confirmar({
      title: 'Reabrir liquidación',
      message: <>Vuelve a borrador y se le podrán cambiar los gastos. Queda registrado en la auditoría.</>,
      confirmLabel: 'Reabrir',
    });
    if (!ok) return;
    try {
      await reabrir.mutateAsync();
      toast.success('Liquidación reabierta.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal open onClose={onClose} title={`${liquidacion.serial ?? 'Liquidación'} · ${liquidacion.matricula ?? ''}`} size="xl">
      <div className="space-y-4">

        {/* Cabecera del viaje */}
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-sand bg-sand-l p-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-dark">{liquidacion.ruta || 'Sin ruta'}</div>
            <div className="mt-0.5 text-xs text-dark-3">
              {formatDate(liquidacion.fecha_inicio)} — {formatDate(liquidacion.fecha_fin)}
              {' · '}Piloto {liquidacion.piloto ?? '—'}
            </div>
            {liquidacion.motivo && <div className="mt-1 text-xs text-dark-2">{liquidacion.motivo}</div>}
          </div>
          <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${ESTADO_COLOR[liquidacion.estado] ?? 'bg-sand'}`}>
            {liquidacion.estado}
          </span>
        </div>

        {/* Los tres números */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-card border border-sand bg-white p-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">Costo total del viaje</div>
            <div className="mt-1 text-xl font-extrabold text-dark">{q(liquidacion.total_gtq)}</div>
            <div className="text-[11px] text-dark-3">{d(liquidacion.total_usd)}</div>
          </div>
          <div className="rounded-card border border-sand bg-white p-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">Lo pagó la empresa</div>
            <div className="mt-1 text-xl font-extrabold text-dark">{q(liquidacion.empresa_gtq)}</div>
            <div className="text-[11px] text-dark-3">
              {gastos.filter((g) => g.pagado_por === 'empresa').length} gastos
            </div>
          </div>
          <div className="rounded-card border-2 border-rust bg-rust-l p-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-rust">A reembolsar al piloto</div>
            <div className="mt-1 text-xl font-extrabold text-rust">{q(liquidacion.piloto_gtq)}</div>
            <div className="text-[11px] text-rust">
              {d(liquidacion.piloto_usd)} · {gastos.filter((g) => g.pagado_por === 'piloto').length} gastos
            </div>
          </div>
        </div>

        {/* Los tipos de cambio del viaje */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-dark-3">
          <span className="rounded-md border border-sand bg-white px-2.5 py-1.5">
            Quetzales → dólar: <b className="text-dark">{Number(liquidacion.tc_gtq_usd ?? 0).toFixed(4)}</b>
          </span>
          <span className="rounded-md border border-sand bg-white px-2.5 py-1.5">
            Dólares → quetzal: <b className="text-dark">{Number(liquidacion.tc_usd_gtq ?? 0).toFixed(4)}</b>
          </span>
          {puedeEditar && (
            <button type="button" onClick={() => setEditarTc(true)}
              className="text-teal underline hover:text-teal-d">cambiar</button>
          )}
        </div>

        {/* Los gastos */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-teal-d">
            Gastos · {gastos.length}
          </h3>
          {puedeEditar && (
            <button type="button" onClick={() => { setEditando(null); setFormAbierto(true); }}
              className="rounded-md bg-teal px-3 py-2 text-xs font-extrabold text-white hover:bg-teal-d">
              ＋ Gasto
            </button>
          )}
        </div>

        {gastosQ.isLoading && <p className="text-sm text-dark-3">Cargando…</p>}
        {!gastosQ.isLoading && gastos.length === 0 && (
          <p className="rounded-card border border-dashed border-sand bg-sand-l px-4 py-6 text-center text-sm text-dark-3">
            Todavía no hay gastos. Agregalos conforme vayan saliendo en el viaje.
          </p>
        )}

        {gastos.length > 0 && (
          <div className="overflow-x-auto rounded-card border border-sand">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="bg-sand-l text-[10px] uppercase tracking-wider text-dark-3">
                  <th className="px-2 py-2 text-left">Fecha</th>
                  <th className="px-2 py-2 text-left">Proveedor y detalle</th>
                  <th className="px-2 py-2 text-left">Documento</th>
                  <th className="px-2 py-2 text-center">Pagó</th>
                  <th className="px-2 py-2 text-left">Medio</th>
                  <th className="px-2 py-2 text-right">Monto</th>
                  <th className="px-2 py-2 text-right">Equivale</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {CATEGORIAS.map((cat) => {
                  const filas = gastos.filter((g) => g.categoria === cat);
                  if (filas.length === 0) return null;
                  return (
                    <Fragment key={cat}>
                          <tr className="bg-teal-l/40">
                            <td colSpan={8} className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-teal-d">
                              {CATEGORIA_LABEL[cat]} · {q(filas.reduce((t, g) => t + Number(g.monto_gtq), 0))}
                            </td>
                          </tr>
                          {filas.map((g) => {
                            const tiene = (adjuntos.data?.get(g.id) ?? 0) > 0;
                            return (
                              <tr key={g.id} className="border-t border-sand">
                                <td className="whitespace-nowrap px-2 py-2 text-dark-2">{formatDate(g.fecha)}</td>
                                <td className="px-2 py-2">
                                  <div className="font-semibold text-dark">{g.proveedor}</div>
                                  {g.detalle && <div className="text-[11px] text-dark-3">{g.detalle}</div>}
                                  {g.categoria === 'Combustible' && (
                                    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                                      g.registro_combustible_id ? 'bg-purple-l text-purple' : 'border border-dashed border-sand text-dark-3'
                                    }`}>
                                      {g.registro_combustible_id ? 'CON VALE' : 'sin vale'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  <div className="font-mono text-[11px] text-dark-2">
                                    {g.documento ?? (g.sin_documento ? '—' : '')}
                                  </div>
                                  <button type="button" onClick={() => setVerAdjuntos(g)}
                                    className={`mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                                      tiene ? 'bg-teal-l text-teal-d'
                                        : g.sin_documento ? 'bg-sand text-dark-3'
                                        : 'bg-gold-light text-gold'
                                    }`}>
                                    {tiene ? '📎 con foto' : g.sin_documento ? 'sin documento' : 'falta foto'}
                                  </button>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                                    g.pagado_por === 'piloto' ? 'bg-rust-l text-rust' : 'bg-teal-l text-teal-d'
                                  }`}>
                                    {g.pagado_por === 'piloto' ? 'PILOTO' : 'EMPRESA'}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-dark-2">{MEDIO_LABEL[g.medio] ?? g.medio}</td>
                                <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-dark">
                                  {g.moneda === 'USD' ? d(g.monto) : q(g.monto)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right text-dark-3">
                                  {g.moneda === 'USD' ? q(g.monto_gtq) : d(g.monto_usd)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right">
                                  {puedeEditar && (
                                    <>
                                      <button type="button" title="Editar"
                                        onClick={() => { setEditando(g); setFormAbierto(true); }}
                                        className="px-1 opacity-50 hover:opacity-100">✏️</button>
                                      <button type="button" title="Quitar" onClick={() => void quitar(g)}
                                        className="px-1 opacity-50 hover:opacity-100">🗑</button>
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Qué falta para cerrar */}
        {abierta && gastos.length > 0 && faltantes.length > 0 && (
          <div className="rounded-card border border-gold/40 bg-gold-light px-3 py-2 text-xs text-gold">
            <b>Faltan {faltantes.length} fotos</b> para poder cerrar:{' '}
            {faltantes.map((g) => `${formatDate(g.fecha)} · ${g.proveedor}`).join('; ')}.
            Subilas, o marcá el gasto como «sin documento» si de verdad no hay.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-sand pt-3">
          <button type="button" onClick={() => setImprimir(true)}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Ver formato oficial
          </button>
          {abierta && canEdit && (
            <button type="button" onClick={() => void cerrarla()}
              disabled={gastos.length === 0 || faltantes.length > 0 || cerrar.isPending}
              title={faltantes.length > 0 ? 'Faltan fotos de facturas' : undefined}
              className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-50">
              {cerrar.isPending ? 'Cerrando…' : 'Cerrar liquidación'}
            </button>
          )}
          {!abierta && esAdmin && liquidacion.estado !== 'Reembolsada' && (
            <button type="button" onClick={() => void reabrirla()} disabled={reabrir.isPending}
              className="rounded-md border border-rust px-4 py-2 text-sm font-semibold text-rust hover:bg-rust-l disabled:opacity-50">
              Reabrir
            </button>
          )}
        </div>
      </div>

      {formAbierto && (
        <GastoFormModal liquidacion={liquidacion} editando={editando}
          onClose={() => { setFormAbierto(false); setEditando(null); void adjuntos.refetch(); }} />
      )}

      {verAdjuntos && (
        <Modal open onClose={() => { setVerAdjuntos(null); void adjuntos.refetch(); }}
          title={`Factura · ${verAdjuntos.proveedor}`}>
          <DocumentAttachment
            entidadTipo="avn_liq_gasto"
            entidadId={verAdjuntos.id}
            canEdit={puedeEditar}
            label="Foto de la factura"
            accept="image/*,application/pdf"
          />
        </Modal>
      )}

      {editarTc && (
        <EditarTipoCambio
          liquidacion={liquidacion}
          onClose={() => setEditarTc(false)}
          onGuardar={async (tcQ, tcD) => {
            await actualizar.mutateAsync({ tc_gtq_usd: tcQ, tc_usd_gtq: tcD });
            toast.success('Tipos de cambio actualizados.');
          }}
        />
      )}

      <PrintableModal open={imprimir} onClose={() => setImprimir(false)}
        title={`Liquidación ${liquidacion.serial ?? ''}`}>
        <LiquidacionPrintable
          liquidacion={liquidacion}
          gastos={gastos}
          piloto={liquidacion.piloto}
          matricula={liquidacion.matricula}
        />
      </PrintableModal>
    </Modal>
  );
}

function EditarTipoCambio({
  liquidacion, onClose, onGuardar,
}: {
  liquidacion: LiquidacionFila;
  onClose: () => void;
  onGuardar: (tcQ: number | null, tcD: number | null) => Promise<void>;
}) {
  const toast = useToast();
  const [a, setA] = useState(String(liquidacion.tc_gtq_usd ?? ''));
  const [b, setB] = useState(String(liquidacion.tc_usd_gtq ?? ''));
  const [guardando, setGuardando] = useState(false);

  return (
    <Modal open onClose={onClose} title="Tipos de cambio del viaje">
      <div className="space-y-3">
        <p className="text-xs text-dark-3">
          Son los que se le proponen a cada gasto nuevo según su moneda. Cambiarlos aquí no
          recalcula los gastos ya capturados, porque cada uno guardó el suyo.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput label="Quetzales → dólar" value={a} onChange={(e) => setA(e.target.value)}
            inputMode="decimal" placeholder="7.5300" />
          <TextInput label="Dólares → quetzal" value={b} onChange={(e) => setB(e.target.value)}
            inputMode="decimal" placeholder="7.9100" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="button" disabled={guardando}
            onClick={async () => {
              setGuardando(true);
              try {
                await onGuardar(parseNumero(a), parseNumero(b));
                onClose();
              } catch (err) {
                toast.error(describeError(err));
              } finally {
                setGuardando(false);
              }
            }}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

