import { useState } from 'react';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { supabase } from '@/lib/supabase';
import { SolicitudPagoPrintable } from '@/modules/finanzas/pagos/SolicitudPagoPrintable';
import type { Pago } from '@/modules/finanzas/pagos/api';
import { fmtDate } from '@/modules/arriaza/utils';
import { VisorDocumento, type Visor } from '../VisorDocumento';
import { acento } from '../constants';
import type { Aeronave } from '../api';
import { RegistroFormModal } from './RegistroFormModal';
import { RegistroPrintable } from './RegistroPrintable';
import { AnularModal } from './AnularModal';
import {
  useAnularRegistro, useBorrarRegistro, useCancelarEnvio, useCombustible,
  useEnviarAPagos, useReactivarRegistro,
} from './hooks';
import type { RegistroCompleto } from './api';

/**
 * En qué va la solicitud de pago de un registro.
 *
 * `libre` es la parte que importa: un registro cuya solicitud se borró vuelve
 * a estar libre, aunque su aviso siga en la tabla de notificaciones. Antes el
 * candado miraba el aviso y no la solicitud, así que un registro cuya SP se
 * eliminaba quedaba atrapado para siempre --ni se podía borrar ni se podía
 * volver a enviar.
 */
function estadoPago(r: RegistroCompleto) {
  const pendiente = !!r.notificacion_id && !r.notificacion_procesada && !r.pago_id;
  return { pendiente, conSolicitud: !!r.pago_id, libre: !r.pago_id && !pendiente };
}

const money = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Control de combustible de la aeronave.
 *
 * Aquí viven los registros de vales y facturas. La solicitud de pago NO se
 * crea aquí: se le avisa a Finanzas → Pagos, que la genera extrayendo los
 * datos de este registro. Es el mismo camino que ya siguen los consumos de
 * tarjeta, y por eso esta pantalla solo muestra en qué va cada una.
 */
export function CombustibleSection({
  aeronave,
  canEdit,
  canBorrar,
}: {
  aeronave: Aeronave;
  canEdit: boolean;
  /** Borrar un registro es de super usuario: anular es la salida de todos. */
  canBorrar: boolean;
}) {
  const col = acento(aeronave.acento);
  const q = useCombustible(aeronave.id);
  const enviar = useEnviarAPagos(aeronave.id);
  const borrar = useBorrarRegistro(aeronave.id);
  const anular = useAnularRegistro(aeronave.id);
  const reactivar = useReactivarRegistro(aeronave.id);
  const cancelarEnvio = useCancelarEnvio(aeronave.id);
  const toast = useToast();
  const confirmar = useConfirm();

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<RegistroCompleto | null>(null);
  const [visor, setVisor] = useState<Visor | null>(null);
  const [pago, setPago] = useState<Pago | null>(null);
  const [cargandoPago, setCargandoPago] = useState<string | null>(null);
  const [viendo, setViendo] = useState<RegistroCompleto | null>(null);
  const [anulando, setAnulando] = useState<RegistroCompleto | null>(null);

  async function mandarAPagos(r: RegistroCompleto) {
    const ok = await confirmar({
      title: 'Enviar a Pagos',
      message: (
        <>
          Se le avisará a Finanzas → Pagos que este registro necesita su solicitud, por{' '}
          <b>{r.moneda} {money(Number(r.total))}</b>. La solicitud la genera quien administra
          pagos, con los datos de este registro.
        </>
      ),
      confirmLabel: 'Enviar',
    });
    if (!ok) return;
    try {
      await enviar.mutateAsync(r);
      toast.success('Notificación enviada a Pagos.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  /** Trae la solicitud que salió de este registro y la muestra tal cual se imprime. */
  async function verSolicitud(r: RegistroCompleto) {
    if (!r.pago_id) return;
    setCargandoPago(r.id);
    try {
      const { data, error } = await supabase
        .from('pagos')
        .select('*')
        .eq('id', r.pago_id)
        .single();
      if (error) throw error;
      setPago(data as unknown as Pago);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setCargandoPago(null);
    }
  }

  async function quitar(r: RegistroCompleto) {
    const { pendiente } = estadoPago(r);
    const ok = await confirmar({
      title: 'Quitar registro',
      message: (
        <>
          ¿Quitar el registro <b>{r.serial ?? ''}</b> del {fmtDate(r.fecha)}?
          {pendiente && ' También se retira el aviso que está esperando en Pagos.'}
        </>
      ),
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync({ id: r.id, notificacionId: pendiente ? r.notificacion_id : null });
      toast.success('Registro quitado.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function reactivarRegistro(r: RegistroCompleto) {
    try {
      await reactivar.mutateAsync(r.id);
      toast.success('Registro reactivado.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  /** Retira de la bandeja de Pagos un aviso que todavía nadie procesó. */
  async function deshacerEnvio(r: RegistroCompleto) {
    if (!r.notificacion_id) return;
    const ok = await confirmar({
      title: 'Cancelar el envío a Pagos',
      message: (
        <>
          El aviso sale de la bandeja de Finanzas → Pagos y el registro vuelve a quedar libre para
          enviarse de nuevo o para quitarse. La solicitud todavía no existe, así que no se pierde
          nada.
        </>
      ),
      confirmLabel: 'Cancelar el envío',
      danger: true,
    });
    if (!ok) return;
    try {
      await cancelarEnvio.mutateAsync(r.notificacion_id);
      toast.success('Envío cancelado.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const registros = q.data ?? [];
  // Un registro anulado sigue en la lista pero no es dinero facturado.
  const anulados = registros.filter((r) => r.cancelado_en).length;
  const totalGeneral = registros
    .filter((r) => !r.cancelado_en)
    .reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-sand bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-teal-d">
              Control de fuel · {aeronave.matricula}
            </h2>
            <p className="mt-0.5 text-[11px] text-dark-3">
              Registro de vales y facturas. De aquí sale la solicitud de pago.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setEditando(null);
                setAbierto(true);
              }}
              className="rounded-md bg-teal px-3 py-2 text-xs font-extrabold text-white hover:bg-teal-d"
            >
              ＋ Nuevo registro
            </button>
          )}
        </div>

        {q.isLoading && <p className="text-sm text-dark-3">Cargando registros…</p>}

        {q.isError && (
          <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-sm text-rust">
            {describeError(q.error)}
          </div>
        )}

        {q.data && registros.length === 0 && (
          <p className="py-4 text-sm italic text-dark-3">
            Todavía no hay registros de combustible.
          </p>
        )}

        {registros.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr
                  className="text-left"
                  style={{ backgroundColor: col.light, color: col.dark }}
                >
                  <th className="whitespace-nowrap px-2 py-2 font-extrabold">No. de registro</th>
                  <th className="whitespace-nowrap px-2 py-2 font-extrabold">Fecha</th>
                  <th className="px-2 py-2 font-extrabold">Vale</th>
                  <th className="px-2 py-2 font-extrabold">Factura</th>
                  <th className="px-2 py-2 font-extrabold">FER/AP</th>
                  <th className="px-2 py-2 font-extrabold">Productos</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-extrabold">Monto</th>
                  <th className="whitespace-nowrap px-2 py-2 text-center font-extrabold">
                    Solicitud de pago
                  </th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => {
                  const est = estadoPago(r);
                  const anulado = !!r.cancelado_en;
                  return (
                  <tr key={r.id} className="border-b border-sand" style={{ opacity: anulado ? 0.55 : 1 }}>
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] font-extrabold text-dark">
                      {r.serial ?? '—'}
                      {anulado && (
                        <span
                          className="ml-1 rounded bg-rust-l px-1 font-sans text-[9px] font-extrabold uppercase text-rust"
                          title={r.cancelacion_nota ?? undefined}
                        >
                          anulado
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-dark-2">{fmtDate(r.fecha)}</td>
                    <td className="px-2 py-2 text-dark-2">{r.vale ?? '—'}</td>
                    <td className="px-2 py-2 text-dark-2">{r.factura ?? '—'}</td>
                    <td className="px-2 py-2 text-dark-2">{r.fer_ap ?? '—'}</td>
                    <td className="px-2 py-2 text-dark-3">
                      {r.lineas.map((l) => `${l.producto} ${l.galones}g`).join(' · ') || '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-extrabold text-dark">
                      {r.moneda} {money(Number(r.total))}
                    </td>

                    {/* El estado de la solicitud: sin enviar, enviada y esperando,
                        o ya generada y se puede ver. */}
                    <td className="whitespace-nowrap px-2 py-2 text-center">
                      {est.conSolicitud ? (
                        <button
                          type="button"
                          onClick={() => void verSolicitud(r)}
                          disabled={cargandoPago === r.id}
                          className="rounded-md border border-teal/40 px-2 py-1 text-[11px] font-extrabold text-teal-d hover:bg-teal-l disabled:opacity-60"
                        >
                          {cargandoPago === r.id ? 'Abriendo…' : `👁 Ver ${r.pago_serial ?? 'SP'}`}
                        </button>
                      ) : est.pendiente ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="rounded-full bg-gold-light px-2 py-1 text-[10px] font-extrabold uppercase text-gold">
                            enviada a pagos
                          </span>
                          {/* Mientras nadie la procese, el envío se puede deshacer. */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => void deshacerEnvio(r)}
                              title="Cancelar el envío a Pagos"
                              className="text-[11px] text-dark-3 hover:text-rust"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ) : canEdit ? (
                        <button
                          type="button"
                          onClick={() => void mandarAPagos(r)}
                          className="rounded-md px-2 py-1 text-[11px] font-extrabold text-white"
                          style={{ backgroundColor: col.solid }}
                        >
                          Enviar a SP
                        </button>
                      ) : (
                        <span className="text-dark-3">—</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      {r.archivo_path && (
                        <button
                          type="button"
                          onClick={() =>
                            setVisor({
                              tipo: 'archivo',
                              path: r.archivo_path as string,
                              titulo: `${r.serial ?? 'Registro'} · ${r.factura ?? ''}`,
                              nombre: r.archivo_nombre,
                            })
                          }
                          title="Ver el vale o la factura"
                          className="px-1 text-[12px] opacity-50 hover:opacity-100"
                        >
                          📎
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setViendo(r)}
                        title="Ver el registro completo"
                        className="px-1 text-[12px] opacity-50 hover:opacity-100"
                      >
                        👁
                      </button>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditando(r);
                              setAbierto(true);
                            }}
                            title="Editar"
                            className="px-1 text-[12px] opacity-50 hover:opacity-100"
                          >
                            ✏️
                          </button>
                          {/* Anular es la salida cuando borrar no es opción: el
                              registro se queda pero deja de sumar. */}
                          {anulado ? (
                            <button
                              type="button"
                              onClick={() => void reactivarRegistro(r)}
                              title="Reactivar"
                              className="px-1 text-[12px] opacity-50 hover:opacity-100"
                            >
                              ↺
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAnulando(r)}
                              title="Anular"
                              className="px-1 text-[12px] opacity-50 hover:opacity-100"
                            >
                              🚫
                            </button>
                          )}
                          {/* Borrar solo mientras no haya una solicitud viva: esa
                              quedaría apuntando al vacío. Que el registro HAYA
                              tenido una no cuenta -- si la borraron, el registro
                              vuelve a estar libre.
                              Y solo para el super usuario: para todos los demás
                              la salida es anular, que deja rastro. */}
                          {canBorrar && !est.conSolicitud && (
                            <button
                              type="button"
                              onClick={() => void quitar(r)}
                              title="Quitar"
                              className="px-1 text-[12px] opacity-50 hover:opacity-100"
                            >
                              🗑
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="px-2 py-2 text-right text-[11px] font-extrabold uppercase tracking-wider text-dark-2">
                    Total facturado
                    {anulados > 0 && (
                      <span className="ml-1 font-sans normal-case tracking-normal text-dark-3">
                        (sin {anulados} anulado{anulados === 1 ? '' : 's'})
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-heading text-sm font-extrabold" style={{ color: col.dark }}>
                    {money(totalGeneral)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <RegistroFormModal
        open={abierto}
        aeronave={aeronave}
        editando={editando}
        onClose={() => setAbierto(false)}
      />

      <VisorDocumento visor={visor} onClose={() => setVisor(null)} />

      {viendo && (
        <RegistroPrintable
          registro={viendo}
          aeronave={aeronave}
          onClose={() => setViendo(null)}
          onVerArchivo={() =>
            setVisor({
              tipo: 'archivo',
              path: viendo.archivo_path as string,
              titulo: `${viendo.serial ?? 'Registro'} · ${viendo.factura ?? ''}`,
              nombre: viendo.archivo_nombre,
            })
          }
          onVerSolicitud={() => void verSolicitud(viendo)}
          cargandoSolicitud={cargandoPago === viendo.id}
        />
      )}

      {anulando && (
        <AnularModal
          registro={anulando}
          onClose={() => setAnulando(null)}
          onConfirm={async (nota) => {
            try {
              await anular.mutateAsync({ id: anulando.id, nota });
              toast.success('Registro anulado.');
            } catch (err) {
              toast.error(describeError(err));
            }
          }}
        />
      )}

      {pago && (
        <PrintableModal
          open
          onClose={() => setPago(null)}
          title={`Solicitud de pago ${pago.serial ?? ''}`}
        >
          <SolicitudPagoPrintable pago={pago} />
        </PrintableModal>
      )}
    </div>
  );
}
