import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { useAttTerrestresByViaje, useDeleteAttTerrestre } from './hooks';
import { TerrestreFormModal } from './TerrestreFormModal';
import { TerrestrePrintable } from './TerrestrePrintable';
import { totalTerrestre } from './full-api';
import type { AttTerrestre } from './api';

const META = SERVICE_META.terrestre;

type Props = {
  viajeId: string;
  canEdit: boolean;
  tripNo?: string | null;
  autoOpenCreate?: boolean;
  onDidOpenCreate?: () => void;
};

/** Traslados terrestres de un viaje. */
export function TerrestresSection({ viajeId, canEdit, tripNo, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttTerrestresByViaje(viajeId);
  const remove = useDeleteAttTerrestre();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [viendo, setViendo] = useState<AttTerrestre | null>(null);

  const rows = query.data ?? [];

  if (autoOpenCreate && editing === null) {
    setEditing({});
    onDidOpenCreate?.();
  }

  async function handleDelete(x: AttTerrestre) {
    const ok = await confirm({
      title: 'Borrar traslado terrestre',
      message: <>¿Borrar el traslado terrestre de <strong>{x.prestador}</strong>?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: x.id, viajeId });
      toast.success('Traslado terrestre borrado.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
          {META.icon} Traslados terrestres{' '}
          <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing({})}
            style={{ backgroundColor: META.solid }}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            + Nuevo traslado
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
        <div className="text-xs italic text-dark-3">Sin traslados terrestres.</div>
      )}

      {rows.map((x: AttTerrestre) => (
        <div
          key={x.id}
          className="mb-1 flex items-center gap-3 rounded-md border-l-4 bg-sand-l px-3 py-2"
          style={{ borderLeftColor: META.solid }}
        >
          <span className="text-lg" style={{ color: META.solid }}>{META.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-extrabold" style={{ color: META.dark }}>
                {x.prestador}
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
            </div>
            <div className="truncate text-[11px] text-dark-3">
              {[
                x.tipo_veh,
                x.ruta || (x.origen || x.destino ? `${x.origen ?? '—'} → ${x.destino ?? '—'}` : null),
                x.fecha ? fmtDate(x.fecha) : null,
                x.personas ? `${x.personas} persona${x.personas === 1 ? '' : 's'}` : null,
                x.tipo === 'RT' ? 'Ida y vuelta' : 'Solo ida',
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-heading text-sm font-extrabold" style={{ color: META.dark }}>
              {x.moneda ?? 'USD'} {totalTerrestre(x.tarifa, x.personas, x.monto_extras).toFixed(2)}
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
        <TerrestrePrintable open onClose={() => setViendo(null)} terrestre={viendo} tripNo={tripNo} />
      )}

      {editing && (
        <TerrestreFormModal open viajeId={viajeId} terrestreId={editing.id} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
