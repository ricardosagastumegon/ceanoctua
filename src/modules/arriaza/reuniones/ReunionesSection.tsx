import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { useAttReunionesByViaje, useDeleteAttReunion } from './hooks';
import { ReunionFormModal } from './ReunionFormModal';
import { ReunionPrintable } from './ReunionPrintable';
import { listarParticipantes } from './full-api';
import type { AttReunion } from './api';

const META = SERVICE_META.reunion;

type Props = {
  viajeId: string;
  canEdit: boolean;
  tripNo?: string | null;
  autoOpenCreate?: boolean;
  onDidOpenCreate?: () => void;
};

/** Reuniones de un viaje. Es el único servicio sin costo. */
export function ReunionesSection({ viajeId, canEdit, tripNo, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttReunionesByViaje(viajeId);
  const remove = useDeleteAttReunion();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [viendo, setViendo] = useState<AttReunion | null>(null);

  // Los participantes solo se piden al abrir la vista previa.
  const participantes = useQuery({
    queryKey: ['att_reunion_participantes', viendo?.id],
    queryFn: () => listarParticipantes(viendo?.id as string),
    enabled: !!viendo?.id,
  });

  const rows = query.data ?? [];

  if (autoOpenCreate && editing === null) {
    setEditing({});
    onDidOpenCreate?.();
  }

  async function handleDelete(r: AttReunion) {
    const ok = await confirm({
      title: 'Borrar reunión',
      message: <>¿Borrar la reunión <strong>{r.titulo || r.cita}</strong>?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: r.id, viajeId });
      toast.success('Reunión borrada.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
          {META.icon} Reuniones{' '}
          <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing({})}
            style={{ backgroundColor: META.solid }}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            + Nueva reunión
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
        <div className="text-xs italic text-dark-3">Sin reuniones agendadas.</div>
      )}

      {rows.map((r: AttReunion) => (
        <div
          key={r.id}
          className="mb-1 flex items-center gap-3 rounded-md border-l-4 bg-sand-l px-3 py-2"
          style={{ borderLeftColor: META.solid }}
        >
          <span className="text-lg" style={{ color: META.solid }}>{META.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-extrabold" style={{ color: META.dark }}>
                {r.titulo || r.cita || 'Reunión'}
              </span>
              {r.tipo && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                  style={{ backgroundColor: META.light, color: META.dark }}
                >
                  {r.tipo}
                </span>
              )}
            </div>
            <div className="truncate text-[11px] text-dark-3">
              {[
                r.fecha ? fmtDate(r.fecha) : null,
                r.hora ? `${r.hora.slice(0, 5)}${r.hora_fin ? `—${r.hora_fin.slice(0, 5)}` : ''}` : null,
                r.lugar,
                r.participantes,
              ].filter(Boolean).join(' · ')}
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
      ))}

      {viendo && (
        <ReunionPrintable
          open
          onClose={() => setViendo(null)}
          reunion={viendo}
          participantes={participantes.data ?? []}
          tripNo={tripNo}
        />
      )}

      {editing && (
        <ReunionFormModal open viajeId={viajeId} reunionId={editing.id} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
