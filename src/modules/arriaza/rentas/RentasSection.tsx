import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { BotonCancelar } from '../shared/BotonCancelar';
import { fmtDate } from '../utils';
import { useAttRentasByViaje, useDeleteAttRenta } from './hooks';
import { RentaFormModal } from './RentaFormModal';
import { RentaPrintable } from './RentaPrintable';
import { leerExtras } from './full-api';
import type { AttRenta } from './api';

const META = SERVICE_META.renta;

type Props = {
  viajeId: string;
  canEdit: boolean;
  tripNo?: string | null;
  autoOpenCreate?: boolean;
  onDidOpenCreate?: () => void;
};

/** Rentas de vehículo de un viaje. */
export function RentasSection({ viajeId, canEdit, tripNo, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttRentasByViaje(viajeId);
  const remove = useDeleteAttRenta();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [viendo, setViendo] = useState<AttRenta | null>(null);

  const rows = query.data ?? [];

  if (autoOpenCreate && editing === null) {
    setEditing({});
    onDidOpenCreate?.();
  }

  async function handleDelete(r: AttRenta) {
    const ok = await confirm({
      title: 'Borrar renta',
      message: <>¿Borrar la renta de <strong>{r.nombre}</strong>?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: r.id, viajeId });
      toast.success('Renta borrada.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  function total(r: AttRenta): number {
    return (
      (Number(r.tarifa) || 0) * (Number(r.dias) || 0) +
      (Number(r.deposito) || 0) +
      leerExtras(r.extras).reduce((s, e) => s + (Number(e.amount) || 0), 0)
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
          {META.icon} Renta de vehículos{' '}
          <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing({})}
            style={{ backgroundColor: META.solid }}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            + Nueva renta
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
        <div className="text-xs italic text-dark-3">Sin rentas de vehículo.</div>
      )}

      {rows.map((r: AttRenta) => (
        <div
          key={r.id}
          className="mb-1 flex items-center gap-3 rounded-md border-l-4 bg-sand-l px-3 py-2"
          style={{ borderLeftColor: META.solid }}
        >
          <span className="text-lg" style={{ color: META.solid }}>{META.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-extrabold" style={{ color: META.dark }}>
                {r.nombre}
              </span>
              {r.estado_pago && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                  style={{ backgroundColor: META.light, color: META.dark }}
                >
                  {r.estado_pago}
                </span>
              )}
              {r.confirmacion && (
                <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-dark-2">
                  {r.confirmacion}
                </span>
              )}
            </div>
            <div className="truncate text-[11px] text-dark-3">
              {[
                [r.marca, r.modelo, r.tipo_veh].filter(Boolean).join(' ') || null,
                r.ciudad,
                r.recepcion_fecha
                  ? `${fmtDate(r.recepcion_fecha)}${r.entrega_fecha ? ` — ${fmtDate(r.entrega_fecha)}` : ''}`
                  : null,
                r.dias ? `${r.dias} día${r.dias === 1 ? '' : 's'}` : null,
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-heading text-sm font-extrabold" style={{ color: META.dark }}>
              {r.moneda ?? 'USD'} {total(r).toFixed(2)}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setViendo(r)}
              className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal"
              title="Ver · vista previa imprimible"
            >
              👁
            </button>
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing({ id: r.id })}
                  className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal"
                  title="Editar"
                >
                  ✏️
                </button>
                <BotonCancelar
                  tabla="att_rentas"
                  viajeId={viajeId}
                  servicio={{
                    id: r.id,
                    nombre: r.nombre,
                    monto: r.monto,
                    moneda: r.moneda,
                    estado_pago: r.estado_pago,
                    reintegro: r.reintegro,
                    reintegro_nota: r.reintegro_nota,
                  }}
                  onDone={() => void query.refetch()}
                />
                <button
                  type="button"
                  onClick={() => void handleDelete(r)}
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

      {viendo && <RentaPrintable open onClose={() => setViendo(null)} renta={viendo} tripNo={tripNo} />}

      {editing && (
        <RentaFormModal open viajeId={viajeId} rentaId={editing.id} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
