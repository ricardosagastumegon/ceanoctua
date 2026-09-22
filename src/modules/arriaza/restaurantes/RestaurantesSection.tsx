import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { useDeleteRestaurante, useRestaurantes } from './hooks';
import { RestauranteFormModal } from './RestauranteFormModal';
import { RestaurantePrintable } from './RestaurantePrintable';
import { diasParaCancelar } from './full-api';
import type { AttRestaurante } from './api';

const META = SERVICE_META.restaurantes;

type Props = {
  viajeId: string;
  canEdit: boolean;
  tripNo?: string | null;
  autoOpenCreate?: boolean;
  onDidOpenCreate?: () => void;
};

/**
 * Restaurantes de un viaje.
 *
 * La fila avisa si la cancelación gratuita está por vencer: es el dato que se
 * pasa por alto y que cuesta dinero.
 */
export function RestaurantesSection({ viajeId, canEdit, tripNo, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useRestaurantes(viajeId);
  const remove = useDeleteRestaurante(viajeId);
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [viendo, setViendo] = useState<AttRestaurante | null>(null);

  const rows = query.data ?? [];

  if (autoOpenCreate && editing === null) {
    setEditing({});
    onDidOpenCreate?.();
  }

  async function handleDelete(r: AttRestaurante) {
    const ok = await confirm({
      title: 'Borrar restaurante',
      message: (
        <>
          ¿Borrar la reserva de <strong>{r.nombre}</strong>?
        </>
      ),
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(r.id);
      toast.success('Reserva borrada.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
          {META.icon} Restaurantes{' '}
          <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing({})}
            style={{ backgroundColor: META.solid }}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            + Nuevo restaurante
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
        <div className="text-xs italic text-dark-3">Sin reservas de restaurante.</div>
      )}

      {rows.map((r) => {
        const dias = r.cancelacion_gratuita ? diasParaCancelar(r.cancelacion_fecha) : null;
        return (
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
                {r.michelin && (
                  <span className="text-[11px]" style={{ color: META.solid }} title="Michelin">
                    {'★'.repeat(r.stars ?? 0) || '★'}
                  </span>
                )}
                {r.estado_pago && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                    style={{ backgroundColor: META.light, color: META.dark }}
                  >
                    {r.estado_pago}
                  </span>
                )}
                {dias !== null && dias <= 5 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                      dias < 0 ? 'bg-rust-l text-rust' : 'bg-gold-light text-gold'
                    }`}
                    title="Cancelación gratuita"
                  >
                    {dias < 0 ? 'cancelación vencida' : dias === 0 ? 'vence hoy' : `cancela en ${dias}d`}
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] text-dark-3">
                {[
                  r.specialty,
                  r.ciudad,
                  r.fecha ? `${fmtDate(r.fecha)}${r.hora ? ` · ${r.hora.slice(0, 5)}` : ''}` : null,
                  r.covers ? `${r.covers} comensal${r.covers === 1 ? '' : 'es'}` : null,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-heading text-sm font-extrabold" style={{ color: META.dark }}>
                {r.moneda ?? 'USD'} {Number(r.monto ?? 0).toFixed(2)}
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
        );
      })}

      {viendo && (
        <RestaurantePrintable open onClose={() => setViendo(null)} restaurante={viendo} tripNo={tripNo} />
      )}

      {editing && (
        <RestauranteFormModal
          open
          viajeId={viajeId}
          restauranteId={editing.id}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
