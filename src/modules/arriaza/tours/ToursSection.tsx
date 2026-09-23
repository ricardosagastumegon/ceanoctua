import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { BotonCancelar } from '../shared/BotonCancelar';
import { fmtDate } from '../utils';
import { useAttToursByViaje, useDeleteAttTour } from './hooks';
import { TourFormModal } from './TourFormModal';
import { TourPrintable } from './TourPrintable';
import { totalTour } from './full-api';
import type { AttTour } from './api';

const META = SERVICE_META.tours;

type Props = {
  viajeId: string;
  canEdit: boolean;
  tripNo?: string | null;
  autoOpenCreate?: boolean;
  onDidOpenCreate?: () => void;
};

/** Tours de un viaje. */
export function ToursSection({ viajeId, canEdit, tripNo, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttToursByViaje(viajeId);
  const remove = useDeleteAttTour();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [viendo, setViendo] = useState<AttTour | null>(null);

  const rows = query.data ?? [];

  if (autoOpenCreate && editing === null) {
    setEditing({});
    onDidOpenCreate?.();
  }

  async function handleDelete(t: AttTour) {
    const ok = await confirm({
      title: 'Borrar tour',
      message: <>¿Borrar el tour <strong>{t.nombre || t.prestador}</strong>?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: t.id, viajeId });
      toast.success('Tour borrado.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
          {META.icon} Tours{' '}
          <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing({})}
            style={{ backgroundColor: META.solid }}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            + Nuevo tour
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
        <div className="text-xs italic text-dark-3">Sin tours agregados.</div>
      )}

      {rows.map((t: AttTour) => (
        <div
          key={t.id}
          className="mb-1 flex items-center gap-3 rounded-md border-l-4 bg-sand-l px-3 py-2"
          style={{ borderLeftColor: META.solid }}
        >
          <span className="text-lg" style={{ color: META.solid }}>{META.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-extrabold" style={{ color: META.dark }}>
                {t.nombre || t.prestador}
              </span>
              {t.estado_pago && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                  style={{ backgroundColor: META.light, color: META.dark }}
                >
                  {t.estado_pago}
                </span>
              )}
              {t.confirmacion && (
                <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-dark-2">
                  {t.confirmacion}
                </span>
              )}
            </div>
            <div className="truncate text-[11px] text-dark-3">
              {[
                t.nombre ? t.prestador : null,
                t.ciudad,
                t.fecha ? fmtDate(t.fecha) : null,
                t.hora ? `${t.hora.slice(0, 5)}${t.hora_fin ? `—${t.hora_fin.slice(0, 5)}` : ''}` : null,
                t.personas ? `${t.personas} persona${t.personas === 1 ? '' : 's'}` : null,
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-heading text-sm font-extrabold" style={{ color: META.dark }}>
              {t.moneda ?? 'USD'} {totalTour(t.tarifa, t.personas).toFixed(2)}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setViendo(t)}
              className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal"
              title="Ver · vista previa imprimible"
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
                  tabla="att_tours"
                  viajeId={viajeId}
                  servicio={{
                    id: t.id,
                    nombre: t.nombre || t.prestador,
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
      ))}

      {viendo && <TourPrintable open onClose={() => setViendo(null)} tour={viendo} tripNo={tripNo} />}

      {editing && (
        <TourFormModal open viajeId={viajeId} tourId={editing.id} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
