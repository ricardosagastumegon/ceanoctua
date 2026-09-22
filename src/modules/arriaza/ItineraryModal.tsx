import { useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { tripDateRange, fmtDateLong } from './utils';
import type { AttViaje } from './viajes/api';
import { useAttDayPlans } from './day-plans/hooks';
import { useAttDayPlanRowsByViaje } from './day-plans/hooks';
import { useAttDayNotes } from './day-notes/hooks';
import { useItineraryEvents } from './viajes/itinerary-events';
import { SERVICE_META } from './constants/serviceMeta';
import logoColor from './arriaza-logo-color.png';

type Props = { open: boolean; onClose: () => void; viaje: AttViaje | null };

// Modal del Itinerario Final del viaje · paridad con el modal grande del HTML.
// Muestra día por día (según fecha_ini → fecha_fin del viaje) los rows del
// day_plan de cada fecha + la nota del día si existe.
// Botón "Imprimir" abre el diálogo nativo del navegador.
export function ItineraryModal({ open, onClose, viaje }: Props) {
  const plansQuery = useAttDayPlans();
  const rowsQuery = useAttDayPlanRowsByViaje(viaje?.id);
  const notesQuery = useAttDayNotes();
  // Los servicios reservados entran al itinerario por su cuenta: un vuelo o un
  // hotel no deberían depender de que alguien los escriba a mano en el día.
  const eventsQuery = useItineraryEvents(viaje?.id, open);

  const days = useMemo(() => {
    if (!viaje) return [];
    const dates = tripDateRange(viaje.fecha_ini, viaje.fecha_fin);
    const plans = (plansQuery.data ?? []).filter((p) => p.viaje_id === viaje.id);
    const rows = rowsQuery.data ?? [];
    const notes = (notesQuery.data ?? []).filter((n) => n.viaje_id === viaje.id);
    const eventos = eventsQuery.data ?? [];
    return dates.map((dateStr, i) => {
      const plan = plans.find((p) => p.fecha === dateStr);
      const dayRows = plan ? rows.filter((r) => r.day_plan_id === plan.id) : [];
      const note = notes.find((n) => n.fecha === dateStr);
      const servicios = eventos.filter((e) => e.fecha === dateStr);
      return { i: i + 1, dateStr, plan, dayRows, note, servicios };
    });
  }, [viaje, plansQuery.data, rowsQuery.data, notesQuery.data, eventsQuery.data]);

  if (!viaje) return null;

  return (
    <Modal open={open} onClose={onClose} title={`📋 Itinerario · ${viaje.titulo}`} size="xl">
      <div id="tt-itinerary-print" className="space-y-4">
        <header className="flex items-center justify-between rounded-lg border-b-4 border-gold bg-sand-l px-5 py-3">
          <img src={logoColor} alt="Arriaza Tour & Travel" className="h-9 w-auto" />
          <div className="text-right">
            <div className="font-heading text-lg font-extrabold text-dark">{viaje.titulo}</div>
            <div className="text-[11px] font-semibold text-dark-3">
              {viaje.trip_no ? `${viaje.trip_no} · ` : ''}Itinerario final
            </div>
          </div>
        </header>
        {days.length === 0 && (
          <p className="text-sm italic text-dark-3">
            Este viaje no tiene fechas de inicio/fin definidas — no puedo generar el itinerario por día.
          </p>
        )}
        {days.map(({ i, dateStr, plan, dayRows, note, servicios }) => (
          <section key={dateStr} className="rounded-lg border border-sand bg-white p-4">
            <header className="mb-2 flex items-baseline justify-between border-b border-sand pb-2">
              <div className="text-sm font-extrabold text-teal-d">Día {i}</div>
              <div className="text-xs font-semibold text-dark-3">{fmtDateLong(dateStr)}</div>
            </header>
            {plan?.lugar && (
              <div className="mb-2 text-xs font-semibold text-dark-2">📍 {plan.lugar}</div>
            )}
            {dayRows.length === 0 && !note && servicios.length === 0 && (
              <p className="text-xs italic text-dark-3">Sin actividades planificadas para este día.</p>
            )}

            {/* Servicios reservados que caen en este día. */}
            {servicios.length > 0 && (
              <div className="mb-2 space-y-1">
                {servicios.map((e, k) => {
                  const meta = SERVICE_META[e.servicio];
                  return (
                    <div
                      key={`${e.servicio}-${k}`}
                      className="flex items-center gap-2 rounded-md border-l-4 px-3 py-1.5 text-xs"
                      style={{ borderLeftColor: meta.solid, backgroundColor: meta.light }}
                    >
                      <span className="w-12 shrink-0 font-extrabold" style={{ color: meta.dark }}>
                        {e.hora || '—'}
                      </span>
                      <span className="shrink-0">{meta.icon}</span>
                      <span className="font-extrabold" style={{ color: meta.dark }}>{e.titulo}</span>
                      {e.detalle && <span className="truncate text-dark-3">· {e.detalle}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {dayRows.length > 0 && (
              <div className="space-y-1">
                {dayRows.map((r) => (
                  <div key={r.id} className="flex gap-3 rounded-md bg-sand-l px-3 py-1.5 text-xs">
                    <div className="w-16 shrink-0 font-extrabold text-teal-d">{r.horario ?? '—'}</div>
                    <div className="flex-1 text-dark-2">{r.itinerario ?? '—'}</div>
                    {r.es_auto_reunion && <span className="rounded-full bg-purple/10 px-2 text-[10px] font-extrabold text-purple">reunión</span>}
                  </div>
                ))}
              </div>
            )}
            {note && (
              <div className="mt-2 rounded-md border-l-4 border-gold bg-gold-light/50 px-3 py-2 text-xs text-dark-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gold">Nota del día</div>
                <div className="mt-0.5 whitespace-pre-wrap">{note.texto}</div>
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
          Cerrar
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-teal px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-d"
        >
          🖨 Imprimir / Guardar PDF
        </button>
      </div>
    </Modal>
  );
}
