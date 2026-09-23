import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { tripDateRange, fmtDate, fmtDateLong } from './utils';
import { SERVICE_META, type ServiceKey } from './constants/serviceMeta';
import logoColor from './arriaza-logo-color.png';
import type { AttViaje } from './viajes/api';
import {
  useAttDayPlans,
  useAttDayPlanRowsByViaje,
  useCreateAttDayPlan,
  useCreateAttDayPlanRow,
  useDeleteAttDayPlanRow,
  useUpdateAttDayPlanRow,
} from './day-plans/hooks';
import { useAttDayNotes } from './day-notes/hooks';
import { useItineraryEvents } from './viajes/itinerary-events';

type Props = {
  open: boolean;
  onClose: () => void;
  viaje: AttViaje | null;
  canEdit?: boolean;
};

/**
 * Itinerario Final del viaje, día por día.
 *
 * Cada día trae dos cosas: los servicios reservados, que entran solos por su
 * fecha, y las actividades que se escriben a mano — hora y descripción — para
 * rellenar lo que ningún servicio cubre.
 *
 * El día se dibuja como una banda con la fecha y una tarjeta debajo, para que
 * los bloques se distingan de un vistazo, también impresos.
 */
export function ItineraryModal({ open, onClose, viaje, canEdit = false }: Props) {
  const plansQuery = useAttDayPlans();
  const rowsQuery = useAttDayPlanRowsByViaje(viaje?.id);
  const notesQuery = useAttDayNotes();
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
      return {
        i: i + 1,
        dateStr,
        plan,
        dayRows: plan ? rows.filter((r) => r.day_plan_id === plan.id) : [],
        note: notes.find((n) => n.fecha === dateStr),
        servicios: eventos.filter((e) => e.fecha === dateStr),
      };
    });
  }, [viaje, plansQuery.data, rowsQuery.data, notesQuery.data, eventsQuery.data]);

  if (!viaje) return null;

  return (
    <Modal open={open} onClose={onClose} title={`📋 Itinerario · ${viaje.titulo}`} size="xl">
      <div id="tt-itinerary-print" className="space-y-4">
        <header className="flex items-center justify-between rounded-lg border-b-4 border-gold bg-sand-l px-5 py-3">
          <img src={logoColor} alt="Arriaza Tour &amp; Travel" className="h-9 w-auto" />
          <div className="text-right">
            <div className="font-heading text-lg font-extrabold text-dark">{viaje.titulo}</div>
            <div className="text-[11px] font-semibold text-dark-3">
              {viaje.trip_no ? `${viaje.trip_no} · ` : ''}
              {fmtDate(viaje.fecha_ini)} — {fmtDate(viaje.fecha_fin)}
            </div>
          </div>
        </header>

        {days.length === 0 && (
          <p className="text-sm italic text-dark-3">
            Este viaje no tiene fechas de inicio y fin definidas, así que no puedo armar el
            itinerario por día.
          </p>
        )}

        {days.map((d) => (
          <DiaBloque
            key={d.dateStr}
            viajeId={viaje.id}
            dia={d.i}
            fecha={d.dateStr}
            planId={d.plan?.id}
            lugar={d.plan?.lugar}
            filas={d.dayRows}
            nota={d.note?.texto}
            servicios={d.servicios}
            canEdit={canEdit}
          />
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
        >
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

type FilaPlan = {
  id: string;
  horario: string | null;
  itinerario: string | null;
  es_auto_reunion: boolean | null;
};

type EventoDia = { servicio: ServiceKey; hora: string; titulo: string; detalle: string };

function DiaBloque({
  viajeId, dia, fecha, planId, lugar, filas, nota, servicios, canEdit,
}: {
  viajeId: string;
  dia: number;
  fecha: string;
  planId?: string;
  lugar?: string | null;
  filas: FilaPlan[];
  nota?: string | null;
  servicios: EventoDia[];
  canEdit: boolean;
}) {
  const crearPlan = useCreateAttDayPlan();
  const crearFila = useCreateAttDayPlanRow();
  const borrarFila = useDeleteAttDayPlanRow();
  const actualizarFila = useUpdateAttDayPlanRow();
  const toast = useToast();

  const [hora, setHora] = useState('');
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);

  /**
   * El plan del día se crea la primera vez que se le agrega una actividad. No
   * tiene sentido sembrar una fila vacía por cada día del viaje.
   */
  async function agregar() {
    if (!texto.trim()) return;
    setGuardando(true);
    try {
      let id = planId;
      if (!id) {
        const plan = await crearPlan.mutateAsync({ viaje_id: viajeId, fecha, dia: String(dia) });
        id = plan.id;
      }
      await crearFila.mutateAsync({
        day_plan_id: id,
        horario: hora || null,
        itinerario: texto.trim(),
        orden: filas.length,
      });
      setHora('');
      setTexto('');
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function editar(fila: FilaPlan, campo: 'horario' | 'itinerario', valor: string) {
    if ((fila[campo] ?? '') === valor) return;
    try {
      await actualizarFila.mutateAsync({ id: fila.id, patch: { [campo]: valor || null } });
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const vacio = servicios.length === 0 && filas.length === 0 && !nota;

  /**
   * El día se lee en orden de reloj: los servicios reservados y las actividades
   * escritas a mano van en una sola lista, no en dos bloques separados. Lo que
   * no tiene hora cae al final, porque no compite con nada.
   */
  const renglones = useMemo(() => {
    const items = [
      ...servicios.map((e, k) => ({ tipo: 'servicio' as const, hora: e.hora, k: `s-${k}`, evento: e })),
      ...filas.map((f) => ({ tipo: 'fila' as const, hora: f.horario ?? '', k: f.id, fila: f })),
    ];
    return items.sort((a, b) => {
      if (!a.hora && !b.hora) return 0;
      if (!a.hora) return 1;
      if (!b.hora) return -1;
      return a.hora.localeCompare(b.hora);
    });
  }, [servicios, filas]);

  return (
    <article className="overflow-hidden rounded-lg border border-sand shadow-sm">
      {/* Banda del día · es lo que separa los bloques de un vistazo. */}
      <header className="flex flex-wrap items-baseline justify-between gap-2 bg-navy px-4 py-2 text-white">
        <span className="font-heading text-lg font-extrabold">Día {dia}</span>
        <span className="text-sm font-semibold text-white/80">{fmtDateLong(fecha)}</span>
      </header>

      <div className="space-y-2 bg-white px-4 py-3">
        {lugar && <div className="text-xs font-semibold text-dark-2">📍 {lugar}</div>}

        {/* Servicios y actividades, en una sola línea de tiempo. */}
        {renglones.map((r) => {
          if (r.tipo === 'servicio') {
            const e = r.evento;
            const meta = SERVICE_META[e.servicio];
            return (
              <div
                key={r.k}
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
          }
          const f = r.fila;
          return (
            <div key={r.k} className="flex items-center gap-2 rounded-md bg-sand-l px-3 py-1.5 text-xs">
              {canEdit ? (
                <>
                  <input
                    type="time"
                    defaultValue={f.horario ?? ''}
                    onBlur={(ev) => void editar(f, 'horario', ev.target.value)}
                    className="w-24 shrink-0 rounded border border-sand bg-white px-1 py-0.5 font-extrabold text-teal-d"
                  />
                  <input
                    type="text"
                    defaultValue={f.itinerario ?? ''}
                    onBlur={(ev) => void editar(f, 'itinerario', ev.target.value)}
                    className="flex-1 rounded border border-sand bg-white px-2 py-0.5 text-dark-2"
                  />
                  <button
                    type="button"
                    onClick={() => void borrarFila.mutateAsync({ id: f.id, dayPlanId: planId as string })}
                    className="shrink-0 text-dark-3 hover:text-rust"
                    aria-label="Quitar actividad"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="w-16 shrink-0 font-extrabold text-teal-d">{f.horario ?? '—'}</span>
                  <span className="flex-1 text-dark-2">{f.itinerario ?? '—'}</span>
                </>
              )}
              {f.es_auto_reunion && (
                <span className="shrink-0 rounded-full bg-purple/10 px-2 text-[10px] font-extrabold text-purple">
                  reunión
                </span>
              )}
            </div>
          );
        })}

        {nota && (
          <div className="rounded-md border-l-4 border-gold bg-gold-light/50 px-3 py-2 text-xs text-dark-2">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-gold">
              Nota del día
            </div>
            <div className="mt-0.5 whitespace-pre-wrap">{nota}</div>
          </div>
        )}

        {vacio && !canEdit && (
          <p className="text-xs italic text-dark-3">Sin actividades planificadas para este día.</p>
        )}

        {/* Agregar actividad · el "rellenar lo que haga falta" del documento. */}
        {canEdit && (
          <div className="no-print flex flex-wrap items-center gap-2 pt-1">
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-28 rounded-md border border-sand px-2 py-1 text-xs"
              aria-label="Hora"
            />
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void agregar();
                }
              }}
              placeholder="Descripción de la actividad"
              className="min-w-[200px] flex-1 rounded-md border border-sand px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => void agregar()}
              disabled={guardando || !texto.trim()}
              className="rounded-md border border-teal/40 px-3 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : '＋ Agregar'}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
