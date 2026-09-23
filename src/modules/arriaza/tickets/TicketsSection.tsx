import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { BotonCancelar } from '../shared/BotonCancelar';
import { fmtDate } from '../utils';
import { useDeleteTicket, useTickets } from './hooks';
import { TicketFormModal } from './TicketFormModal';
import { TicketPrintable } from './TicketPrintable';
import type { AttTicket } from './api';

const META = SERVICE_META.tickets;

type Props = {
  viajeId: string;
  canEdit: boolean;
  /** Correlativo del viaje, para que la hoja impresa se pueda rastrear. */
  tripNo?: string | null;
  autoOpenCreate?: boolean;
  onDidOpenCreate?: () => void;
};

/** Cuántos pasajeros tiene cada ticket — la fila del flyer los muestra. */
function usePaxPorTicket(ticketIds: string[]) {
  return useQuery({
    queryKey: ['att_ticket_pax_counts', ticketIds.join(',')],
    enabled: ticketIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('att_ticket_pax')
        .select('ticket_id')
        .in('ticket_id', ticketIds)
        .is('deleted_at', null);
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of data ?? []) m.set(r.ticket_id, (m.get(r.ticket_id) ?? 0) + 1);
      return m;
    },
  });
}

/**
 * Tickets aéreos de un viaje.
 *
 * La fila resume solo lo que pide el documento — aerolínea, ruta, fechas, PNR,
 * estatus y total — y el detalle completo vive en el formulario. Si hay varios
 * tickets se apilan uno debajo del otro.
 */
export function TicketsSection({ viajeId, canEdit, tripNo, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useTickets(viajeId);
  const remove = useDeleteTicket(viajeId);
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [viendo, setViendo] = useState<AttTicket | null>(null);

  const rows = query.data ?? [];
  const paxCounts = usePaxPorTicket(rows.map((r) => r.id));

  if (autoOpenCreate && editing === null) {
    setEditing({});
    onDidOpenCreate?.();
  }

  async function handleDelete(t: AttTicket) {
    const ok = await confirm({
      title: 'Borrar ticket aéreo',
      message: (
        <>
          ¿Borrar <strong>{t.titulo ?? t.aerolinea ?? 'el ticket'}</strong> y sus pasajeros?
        </>
      ),
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(t.id);
      toast.success('Ticket borrado.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
          {META.icon} Tickets aéreos{' '}
          <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing({})}
            style={{ backgroundColor: META.solid }}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            + Nuevo ticket
          </button>
        )}
      </div>

      {query.isLoading && <div className="text-xs text-dark-3">Cargando…</div>}
      {query.isError && (
        <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-xs text-rust">
          {describeError(query.error)}
        </div>
      )}
      {!query.isLoading && rows.length === 0 && (
        <div className="text-xs italic text-dark-3">Sin tickets aéreos agregados.</div>
      )}

      {rows.map((t) => {
        const pax = paxCounts.data?.get(t.id) ?? 0;
        return (
          <div
            key={t.id}
            className="mb-1 flex items-center gap-3 rounded-md border-l-4 bg-sand-l px-3 py-2"
            style={{ borderLeftColor: META.solid }}
          >
            <span className="text-lg" style={{ color: META.solid }}>{META.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-extrabold" style={{ color: META.dark }}>
                  {t.titulo ?? `${t.origen ?? '?'} → ${t.destino ?? '?'}`}
                </span>
                {t.estado_pago && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                    style={{ backgroundColor: META.light, color: META.dark }}
                  >
                    {t.estado_pago}
                  </span>
                )}
                {t.codigo_reserva && (
                  <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-dark-2">
                    {t.codigo_reserva}
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] text-dark-3">
                {t.aerolinea ?? '—'}
                {t.origen && t.destino ? ` · ${t.origen} → ${t.destino}` : ''}
                {t.tipo_ticket ? ` · ${t.tipo_ticket} — ${t.tipo_ticket === 'OW' ? 'Solo ida' : 'Ida y vuelta'}` : ''}
                {pax > 0 ? ` · ${pax} pax` : ''}
                {t.fecha_salida ? ` · ${fmtDate(t.fecha_salida)}` : ''}
                {t.fecha_llegada ? ` — ${fmtDate(t.fecha_llegada)}` : ''}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-heading text-sm font-extrabold" style={{ color: META.dark }}>
                {t.moneda ?? 'USD'} {Number(t.monto ?? 0).toFixed(2)}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setViendo(t)}
                className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal"
                title="Vista previa · imprimir o descargar"
              >
                👁
              </button>
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: t.id })}
                    className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal"
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <BotonCancelar
                    tabla="att_tickets"
                    viajeId={viajeId}
                    servicio={{
                      id: t.id,
                      nombre: t.titulo ?? `${t.origen ?? '?'} → ${t.destino ?? '?'}`,
                      monto: t.monto,
                      moneda: t.moneda,
                      estado_pago: t.estado_pago,
                      reintegro: t.reintegro,
                      reintegro_nota: t.reintegro_nota,
                    }}
                    onDone={() => void query.refetch()}
                  />
                  <button
                    type="button"
                    onClick={() => void handleDelete(t)}
                    className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust"
                    title="Eliminar"
                  >
                    🗑
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {viendo && (
        <TicketPrintable open onClose={() => setViendo(null)} ticket={viendo} tripNo={tripNo} />
      )}

      {editing && (
        <TicketFormModal
          open
          viajeId={viajeId}
          ticketId={editing.id}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
