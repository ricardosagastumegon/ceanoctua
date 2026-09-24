import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from './utils';
import { findCountry } from './constants/countries';
import { useUpdateAttViaje } from './viajes/hooks';
import { TripPreviewModal } from './TripPreviewModal';
import { ItineraryModal } from './ItineraryModal';
import type { AttViaje } from './viajes/api';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';

/**
 * Los diez degradados de la carpeta, uno por viaje.
 *
 * Son los mismos del HTML original y los mismos de la paleta de servicios: el
 * archivo se hojea buscando un viaje que se recuerda por su color, y si todos
 * fueran del mismo no habría nada que reconocer. Se asignan por posición y
 * vuelven a empezar después del décimo.
 */
const PALETA = [
  'linear-gradient(135deg,#0d2b2e,#077e84)',
  'linear-gradient(135deg,#3d2f0a,#9e7a1a)',
  'linear-gradient(135deg,#3d1503,#bf4609)',
  'linear-gradient(135deg,#241030,#5a3472)',
  'linear-gradient(135deg,#12280f,#2a6e24)',
  'linear-gradient(135deg,#08252c,#0b5c6e)',
  'linear-gradient(135deg,#161d3c,#3b4d8a)',
  'linear-gradient(135deg,#3d1030,#a83279)',
  'linear-gradient(135deg,#2e2013,#8a5a2e)',
  'linear-gradient(135deg,#2c1a54,#7c3aed)',
];

// Carpeta compacta con viajes finalizados (manual_status='Finalizado').
// Botón "Reactivar" cambia manual_status a 'En curso' para volver al dashboard.
export function FinishedFolder({ viajes, canEdit }: { viajes: AttViaje[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [viendo, setViendo] = useState<AttViaje | null>(null);
  const [itinerario, setItinerario] = useState<AttViaje | null>(null);
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
          📂 Viajes Realizados{' '}
          <span className="ml-2 rounded-full bg-teal-l px-2 text-[10px] text-teal-d">
            {finished.length}
          </span>
        </div>
        <span className="text-xs text-dark-3">{open ? '▾ Ocultar' : '▸ Mostrar'}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {finished.map((v, i) => {
            const flag = findCountry(v.pais)?.flag ?? '📍';
            return (
              <div
                key={v.id}
                className="rounded-md p-3 text-white shadow-sm"
                style={{ background: PALETA[i % PALETA.length] }}
              >
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">
                  {v.trip_no ?? '—'}
                </div>
                <div className="mt-1 font-heading text-sm font-extrabold text-white">
                  {flag} {v.titulo}
                </div>
                <div className="mt-0.5 text-[11px] text-white/70">📍 {v.destino ?? '—'}</div>
                <div className="mt-0.5 text-[11px] text-white/60">
                  📅 {fmtDate(v.fecha_ini)} — {fmtDate(v.fecha_fin)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {/* Un viaje realizado se consulta mucho más de lo que se
                      edita: «Ver» resume todo sin salir de la carpeta. */}
                  <button
                    type="button"
                    onClick={() => setViendo(v)}
                    className="rounded-md border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/20"
                  >
                    👁 Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => setItinerario(v)}
                    className="rounded-md border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/20"
                  >
                    📋 Itinerario
                  </button>
                  <Link
                    to={`/arriaza/viaje/${v.id}`}
                    className="rounded-md border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/20"
                  >
                    Abrir
                  </Link>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => void reactivate(v)}
                      className="rounded-md border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/20"
                    >
                      ↩ Reactivar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TripPreviewModal
        open={!!viendo}
        viaje={viendo}
        onClose={() => setViendo(null)}
        onItinerario={() => {
          setItinerario(viendo);
          setViendo(null);
        }}
      />

      <ItineraryModal
        open={!!itinerario}
        viaje={itinerario}
        canEdit={canEdit}
        onClose={() => setItinerario(null)}
      />
    </section>
  );
}
