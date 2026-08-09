import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtMoney, fmtDate } from '../utils';
import { EstadoPagoBadge } from '../shared/EstadoPagoBadge';
import { ServicePrintable } from '../ServicePrintable';
import { TerrestreForm } from './TerrestreForm';
import { useAttTerrestresByViaje, useCreateAttTerrestre, useUpdateAttTerrestre, useDeleteAttTerrestre } from './hooks';
import { terrestreTotal, type AttTerrestre, type AttTerrestreInsert } from './api';

type Props = { viajeId: string; canEdit: boolean; autoOpenCreate?: boolean; onDidOpenCreate?: () => void };

export function TerrestresSection({ viajeId, canEdit, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttTerrestresByViaje(viajeId);
  const create = useCreateAttTerrestre(); const update = useUpdateAttTerrestre(); const remove = useDeleteAttTerrestre();
  const toast = useToast(); const confirm = useConfirm();
  const [editing, setEditing] = useState<AttTerrestre | null | undefined>(undefined);
  const [printing, setPrinting] = useState<AttTerrestre | null>(null);
  if (autoOpenCreate && editing === undefined) { setEditing(null); onDidOpenCreate?.(); }
  const rows = query.data ?? []; const meta = SERVICE_META.terrestre;

  async function handleSave(values: AttTerrestreInsert) {
    try {
      if (editing && editing.id) { await update.mutateAsync({ id: editing.id, patch: values }); toast.success('Traslado actualizado.'); }
      else { await create.mutateAsync(values); toast.success('Traslado agregado.'); }
      setEditing(undefined);
    } catch (err) { toast.error(describeError(err)); }
  }
  async function handleDelete(x: AttTerrestre) {
    const ok = await confirm({ title: 'Eliminar traslado', message: <>¿Eliminar <strong>{x.prestador}</strong>?</>, danger: true, confirmLabel: 'Eliminar' });
    if (!ok) return;
    try { await remove.mutateAsync({ id: x.id, viajeId }); toast.success('Traslado eliminado.'); } catch (err) { toast.error(describeError(err, 'delete')); }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
          {meta.icon} Traslados Terrestres <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && <button type="button" onClick={() => setEditing(null)} style={{ backgroundColor: meta.solid }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">+ Nuevo</button>}
      </div>
      {query.isLoading && <div className="text-xs text-dark-3">Cargando…</div>}
      {!query.isLoading && rows.length === 0 && <div className="italic text-xs text-dark-3">Sin traslados terrestres.</div>}
      {rows.map((x) => (
        <div key={x.id} className="mb-1 flex items-center gap-2 rounded-md border-l-4 bg-sand-l px-2 py-1.5" style={{ borderLeftColor: meta.solid }}>
          <span className="text-lg" style={{ color: meta.solid }}>{meta.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-extrabold text-dark-2">
              {x.prestador} <span className="text-[10px] font-normal text-dark-3">· {x.tipo}</span>
              <EstadoPagoBadge estado={x.estado_pago} />
            </div>
            <div className="truncate text-[10px] text-dark-3">
              {x.tipo_veh ?? '—'} · {x.origen ?? '—'} → {x.destino ?? '—'}
            </div>
          </div>
          <div className="text-xs font-extrabold text-teal-d">{fmtMoney(terrestreTotal(x))}</div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => setPrinting(x)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal" title="Imprimir">🖨</button>
            {canEdit && (
              <>
                <button type="button" onClick={() => setEditing(x)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal">✏️</button>
                <button type="button" onClick={() => void handleDelete(x)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust">🗑</button>
              </>
            )}
          </div>
        </div>
      ))}
      <ServicePrintable
        open={!!printing}
        onClose={() => setPrinting(null)}
        serviceKey="terrestre"
        title={printing?.prestador ?? ''}
        subtitle={printing ? `${printing.tipo} · ${printing.tipo_veh ?? ''}` : null}
        total={printing ? terrestreTotal(printing) : null}
        estadoPago={printing?.estado_pago ?? null}
        pagadoCon={printing?.pagado_con ?? null}
        confirmacion={printing?.confirmacion ?? null}
        cancelacion={printing?.cancelacion ?? null}
        rows={printing ? [
          { label: 'Fecha', value: fmtDate(printing.fecha) },
          { label: 'Ruta', value: `${printing.origen ?? '—'} → ${printing.destino ?? '—'}` },
          { label: 'ETD/ETA', value: `${printing.etd ?? '—'} / ${printing.eta ?? '—'}` },
          ...(printing.tipo === 'RT' ? [
            { label: 'Regreso fecha', value: fmtDate(printing.ret_fecha) },
            { label: 'Regreso ruta', value: `${printing.ret_origen ?? '—'} → ${printing.ret_destino ?? '—'}` },
          ] : []),
          { label: 'Personas', value: printing.personas ?? '—' },
          { label: 'Tarifa/persona', value: fmtMoney(printing.tarifa) },
          { label: 'Monto extras', value: fmtMoney(printing.monto_extras) },
          { label: 'Inclusiones', value: printing.inclusiones ?? '—' },
        ] : []}
      />
      <TerrestreForm open={editing !== undefined} viajeId={viajeId} editing={editing ?? null} submitting={create.isPending || update.isPending} onClose={() => setEditing(undefined)} onSubmit={handleSave} />
    </div>
  );
}
