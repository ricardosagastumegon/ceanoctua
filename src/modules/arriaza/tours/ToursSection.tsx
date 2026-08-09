import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate, fmtMoney } from '../utils';
import { EstadoPagoBadge } from '../shared/EstadoPagoBadge';
import { ServicePrintable } from '../ServicePrintable';
import { TourForm } from './TourForm';
import { useAttToursByViaje, useCreateAttTour, useUpdateAttTour, useDeleteAttTour } from './hooks';
import { tourTotal, type AttTour, type AttTourInsert } from './api';

type Props = { viajeId: string; canEdit: boolean; autoOpenCreate?: boolean; onDidOpenCreate?: () => void };

export function ToursSection({ viajeId, canEdit, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttToursByViaje(viajeId);
  const create = useCreateAttTour();
  const update = useUpdateAttTour();
  const remove = useDeleteAttTour();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AttTour | null | undefined>(undefined);
  const [printing, setPrinting] = useState<AttTour | null>(null);

  if (autoOpenCreate && editing === undefined) { setEditing(null); onDidOpenCreate?.(); }

  const rows = query.data ?? [];
  const meta = SERVICE_META.tours;

  async function handleSave(values: AttTourInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Tour actualizado.');
      } else {
        await create.mutateAsync(values);
        toast.success('Tour agregado.');
      }
      setEditing(undefined);
    } catch (err) { toast.error(describeError(err)); }
  }

  async function handleDelete(t: AttTour) {
    const ok = await confirm({ title: 'Eliminar tour', message: <>¿Eliminar <strong>{t.prestador}</strong>?</>, danger: true, confirmLabel: 'Eliminar' });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: t.id, viajeId });
      toast.success('Tour eliminado.');
    } catch (err) { toast.error(describeError(err, 'delete')); }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
          {meta.icon} Tours <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setEditing(null)} style={{ backgroundColor: meta.solid }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">+ Nuevo</button>
        )}
      </div>
      {query.isLoading && <div className="text-xs text-dark-3">Cargando…</div>}
      {query.isError && <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-xs text-rust">{describeError(query.error)}</div>}
      {!query.isLoading && rows.length === 0 && <div className="italic text-xs text-dark-3">Sin tours agregados.</div>}
      {rows.map((t) => (
        <div key={t.id} className="mb-1 flex items-center gap-2 rounded-md border-l-4 bg-sand-l px-2 py-1.5" style={{ borderLeftColor: meta.solid }}>
          <span className="text-lg" style={{ color: meta.solid }}>{meta.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-extrabold text-dark-2">
              {t.prestador}
              <EstadoPagoBadge estado={t.estado_pago} />
            </div>
            <div className="truncate text-[10px] text-dark-3">
              {t.ciudad ?? '—'}{t.fecha ? ` · ${fmtDate(t.fecha)}` : ''}{t.hora ? ` · ${t.hora}` : ''}
            </div>
          </div>
          <div className="text-xs font-extrabold text-teal-d">{fmtMoney(tourTotal(t))}</div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => setPrinting(t)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal" title="Imprimir">🖨</button>
            {canEdit && (
              <>
                <button type="button" onClick={() => setEditing(t)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal" title="Editar">✏️</button>
                <button type="button" onClick={() => void handleDelete(t)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust" title="Eliminar">🗑</button>
              </>
            )}
          </div>
        </div>
      ))}
      <ServicePrintable
        open={!!printing}
        onClose={() => setPrinting(null)}
        serviceKey="tours"
        title={printing?.prestador ?? ''}
        subtitle={printing ? `${printing.tipo_servicio ?? ''}${printing.ciudad ? ' · ' + printing.ciudad : ''}` : null}
        total={printing ? tourTotal(printing) : null}
        estadoPago={printing?.estado_pago ?? null}
        pagadoCon={printing?.pagado_con ?? null}
        confirmacion={printing?.confirmacion ?? null}
        cancelacion={printing?.cancelacion ?? null}
        rows={printing ? [
          { label: 'Reserva a nombre de', value: printing.reserva_nombre ?? '—' },
          { label: 'Fecha', value: fmtDate(printing.fecha) },
          { label: 'Hora', value: printing.hora ?? '—' },
          { label: 'Personas', value: printing.personas ?? '—' },
          { label: 'Duración', value: printing.duracion ?? '—' },
          { label: 'Tarifa/persona', value: fmtMoney(printing.tarifa) },
          { label: 'Inclusiones', value: printing.inclusiones ?? '—' },
          { label: 'Descripción', value: printing.descripcion ?? '—' },
        ] : []}
      />
      <TourForm open={editing !== undefined} viajeId={viajeId} editing={editing ?? null} submitting={create.isPending || update.isPending} onClose={() => setEditing(undefined)} onSubmit={handleSave} />
    </div>
  );
}
