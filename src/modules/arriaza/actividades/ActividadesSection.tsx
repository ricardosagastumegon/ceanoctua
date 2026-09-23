import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { useAttActividadesByViaje, useDeleteAttActividadDelViaje } from './hooks';
import { ActividadFormModal } from './ActividadFormModal';
import { ActividadPrintable } from './ActividadPrintable';
import { listarEntradas, totalActividad } from './full-api';
import type { AttActividad } from './api';

const META = SERVICE_META.actividades;

type Props = {
  viajeId: string;
  canEdit: boolean;
  tripNo?: string | null;
  autoOpenCreate?: boolean;
  onDidOpenCreate?: () => void;
};

/** Actividades y eventos de un viaje. */
export function ActividadesSection({ viajeId, canEdit, tripNo, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttActividadesByViaje(viajeId);
  const remove = useDeleteAttActividadDelViaje();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [viendo, setViendo] = useState<AttActividad | null>(null);

  // Las entradas solo se piden cuando se abre la vista previa: la lista de la
  // sección no las necesita.
  const entradas = useQuery({
    queryKey: ['att_actividad_entradas', viendo?.id],
    queryFn: () => listarEntradas(viendo?.id as string),
    enabled: !!viendo?.id && !!viendo?.tiene_tickets,
  });

  const rows = query.data ?? [];

  if (autoOpenCreate && editing === null) {
    setEditing({});
    onDidOpenCreate?.();
  }

  async function handleDelete(x: AttActividad) {
    const ok = await confirm({
      title: 'Borrar actividad',
      message: <>¿Borrar la actividad <strong>{x.evento}</strong>?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: x.id, viajeId });
      toast.success('Actividad borrada.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
          {META.icon} Actividades y eventos{' '}
          <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing({})}
            style={{ backgroundColor: META.solid }}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            + Nueva actividad
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
        <div className="text-xs italic text-dark-3">Sin actividades agregadas.</div>
      )}

      {rows.map((x: AttActividad) => (
        <div
          key={x.id}
          className="mb-1 flex items-center gap-3 rounded-md border-l-4 bg-sand-l px-3 py-2"
          style={{ borderLeftColor: META.solid }}
        >
          <span className="text-lg" style={{ color: META.solid }}>{META.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-extrabold" style={{ color: META.dark }}>
                {x.evento}
              </span>
              {x.estado_pago && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                  style={{ backgroundColor: META.light, color: META.dark }}
                >
                  {x.estado_pago}
                </span>
              )}
              {x.confirmacion && (
                <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-dark-2">
                  {x.confirmacion}
                </span>
              )}
              {x.tiene_tickets && (
                <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-dark-2">
                  🎟 con entradas
                </span>
              )}
            </div>
            <div className="truncate text-[11px] text-dark-3">
              {[
                x.ciudad,
                x.fecha ? fmtDate(x.fecha) : null,
                x.inicio ? `${x.inicio.slice(0, 5)}${x.fin ? `—${x.fin.slice(0, 5)}` : ''}` : null,
                x.personas ? `${x.personas} persona${x.personas === 1 ? '' : 's'}` : null,
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-heading text-sm font-extrabold" style={{ color: META.dark }}>
              {x.moneda ?? 'USD'} {totalActividad(x.tarifa, x.personas, x.monto_extras).toFixed(2)}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setViendo(x)}
              className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal"
              title="Ver · vista previa imprimible"
            >
              👁
            </button>
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing({ id: x.id })}
                  className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal"
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(x)}
                  className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust"
                  title="Eliminar"
                >
                  🗑
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      {viendo && (
        <ActividadPrintable
          open
          onClose={() => setViendo(null)}
          actividad={viendo}
          entradas={entradas.data ?? []}
          tripNo={tripNo}
        />
      )}

      {editing && (
        <ActividadFormModal open viajeId={viajeId} actividadId={editing.id} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
