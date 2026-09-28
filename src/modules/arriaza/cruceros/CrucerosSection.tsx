import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { BotonCancelar } from '../shared/BotonCancelar';
import { fmtDate } from '../utils';
import { CruceroFormModal } from './CruceroFormModal';
import { CruceroPrintable } from './CruceroPrintable';
import { cruceroFullApi, cruceroKeys, listarCruceros, type AttCrucero } from './full-api';

const META = SERVICE_META.crucero;

type Props = {
  viajeId: string;
  canEdit: boolean;
  tripNo?: string | null;
  autoOpenCreate?: boolean;
  onDidOpenCreate?: () => void;
};

/** Los cruceros de un viaje. */
export function CrucerosSection({
  viajeId, canEdit, tripNo, autoOpenCreate, onDidOpenCreate,
}: Props) {
  const query = useQuery({
    queryKey: cruceroKeys.byViaje(viajeId),
    queryFn: () => listarCruceros(viajeId),
  });
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [viendo, setViendo] = useState<AttCrucero | null>(null);

  const rows = query.data ?? [];

  if (autoOpenCreate && editing === null) {
    setEditing({});
    onDidOpenCreate?.();
  }

  async function handleDelete(x: AttCrucero) {
    const ok = await confirm({
      title: 'Borrar crucero',
      message: (
        <>
          ¿Borrar el crucero <strong>{x.titulo || x.ship || 'sin nombre'}</strong> con todos sus
          camarotes, abonos y servicios extra?
        </>
      ),
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await cruceroFullApi.remove(x.id);
      await query.refetch();
      toast.success('Crucero borrado.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
          {META.icon} Cruceros{' '}
          <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing({})}
            style={{ backgroundColor: META.solid }}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            + Nuevo crucero
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
        <div className="text-xs italic text-dark-3">Sin cruceros.</div>
      )}

      {rows.map((x) => (
        <div
          key={x.id}
          className="mb-1 flex items-center gap-3 rounded-md border-l-4 bg-sand-l px-3 py-2"
          style={{ borderLeftColor: META.solid }}
        >
          <span className="text-lg" style={{ color: META.solid }}>{META.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-extrabold" style={{ color: META.dark }}>
                {x.titulo || x.ship || 'Crucero'}
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
                x.ship,
                x.package_type,
                x.salida_fecha ? fmtDate(x.salida_fecha) : null,
                x.retorno_fecha ? `→ ${fmtDate(x.retorno_fecha)}` : null,
                x.noches ? `${x.noches} noches` : null,
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-heading text-sm font-extrabold" style={{ color: META.dark }}>
              {x.moneda ?? 'USD'} {Number(x.monto ?? 0).toFixed(2)}
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
                <BotonCancelar
                  tabla="att_cruceros"
                  viajeId={viajeId}
                  servicio={{
                    id: x.id,
                    nombre: x.titulo || x.ship || 'Crucero',
                    monto: x.monto,
                    moneda: x.moneda,
                    estado_pago: x.estado_pago,
                    reintegro: x.reintegro,
                    reintegro_nota: x.reintegro_nota,
                  }}
                  onDone={() => void query.refetch()}
                />
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
        <CruceroPrintable open onClose={() => setViendo(null)} crucero={viendo} tripNo={tripNo} />
      )}

      {editing && (
        <CruceroFormModal
          open
          viajeId={viajeId}
          cruceroId={editing.id}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
