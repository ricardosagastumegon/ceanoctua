import { useMemo, useState } from 'react';
import { fmtDate } from './utils';
import { findCountry } from './constants/countries';
import { useUpdateAttViaje } from './viajes/hooks';
import type { AttViaje } from './viajes/api';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';

// Carpeta compacta con viajes finalizados (manual_status='Finalizado').
// Botón "Reactivar" cambia manual_status a 'En curso' para volver al dashboard.
export function FinishedFolder({ viajes, canEdit }: { viajes: AttViaje[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateAttViaje();
  const toast = useToast();

  const finished = useMemo(
    () => viajes.filter((v) => (v.manual_status ?? 'Solicitado') === 'Finalizado'),
    [viajes],
  );
  if (finished.length === 0) return null;

  async function reactivate(v: AttViaje) {
    try {
      await update.mutateAsync({ id: v.id, patch: { manual_status: 'En curso' } });
      toast.success('↩ Viaje reactivado en el dashboard.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <section className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-sand bg-white px-4 py-2 text-left hover:bg-sand-l"
      >
        <div className="text-xs font-extrabold uppercase tracking-wider text-dark-2">
          📂 Viajes Realizados <span className="ml-2 rounded-full bg-teal-l px-2 text-[10px] text-teal-d">{finished.length}</span>
        </div>
        <span className="text-xs text-dark-3">{open ? '▾ Ocultar' : '▸ Mostrar'}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {finished.map((v) => {
            const flag = findCountry(v.pais)?.flag ?? '📍';
            return (
              <div key={v.id} className="rounded-md border border-teal/30 bg-gradient-to-br from-teal-d/90 to-navy p-3 text-white">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">{v.trip_no ?? '—'}</div>
                <div className="mt-1 font-heading text-sm font-extrabold text-white">{flag} {v.titulo}</div>
                <div className="mt-0.5 text-[11px] text-white/70">📍 {v.destino ?? '—'}</div>
                <div className="mt-0.5 text-[11px] text-white/60">📅 {fmtDate(v.fecha_ini)} — {fmtDate(v.fecha_fin)}</div>
                {canEdit && (
                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => void reactivate(v)}
                      className="rounded-md border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/20"
                    >
                      ↩ Reactivar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
