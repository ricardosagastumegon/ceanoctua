import { useMemo, useState } from 'react';
import { PrintableModal } from '@/components/ui/PrintableModal';
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

// Colores del documento. Van en hex y no en clases de Tailwind porque al
// imprimir las clases se pueden purgar y esto tiene que salir en papel igual
// que en pantalla.
const TEAL_OSCURO = '#0d2b2e';
const TEAL = '#077e84';
const ARENA_LINEA = '#e8e2d3';
const RIEL = '#ece7da';
const TINTA = '#2a2016';
const TINTA_SUAVE = '#7d7364';

/**
 * La hora sin segundos.
 *
 * Las actividades escritas a mano guardan la hora en una columna `time`, que
 * vuelve como `22:00:00`. Los servicios ya llegan como `HH:MM`, así que sin
 * esto la columna mezclaba los dos formatos y se veía recargada.
 */
const hhmm = (v: string | null | undefined): string => (v ? v.slice(0, 5) : '');

/** Una actividad escrita a mano no es un servicio; se ve distinta a propósito. */
const MANUAL = { solid: '#8a7f70', dark: '#5c5347', light: '#f5f2e9' };

/**
 * Itinerario del viaje, día por día.
 *
 * Esto se le entrega al cliente, así que está armado como un documento y no
 * como una pantalla: portada con la marca, los datos del viaje de un vistazo,
 * y cada día como una línea de tiempo donde cada servicio lleva su color.
 *
 * Cada día trae dos cosas: los servicios reservados, que entran solos por su
 * fecha, y las actividades que se escriben a mano para rellenar lo que ningún
 * servicio cubre.
 */
export function ItineraryModal({ open, onClose, viaje, canEdit = false }: Props) {
  if (!viaje) return null;
  return (
    <PrintableModal open={open} onClose={onClose} title={`Itinerario · ${viaje.titulo}`}>
      <ItinerarioHojas viaje={viaje} canEdit={canEdit} activo={open} />
    </PrintableModal>
  );
}

/**
 * El itinerario en sí, sin el modal alrededor.
 *
 * Vive aparte para que la liquidación completa lo pueda montar fuera de la
 * pantalla y capturarlo sin abrirle una ventana encima al usuario.
 */
export function ItinerarioHojas({
  viaje,
  canEdit = false,
  activo = true,
}: {
  viaje: AttViaje;
  canEdit?: boolean;
  activo?: boolean;
}) {
  const plansQuery = useAttDayPlans();
  const rowsQuery = useAttDayPlanRowsByViaje(viaje?.id);
  const notesQuery = useAttDayNotes();
  const eventsQuery = useItineraryEvents(viaje.id, activo);

  const days = useMemo(() => {
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

  const totalServicios = (eventsQuery.data ?? []).length;
  const noches = Math.max(0, days.length - 1);

  return (
    <div id="tt-itinerary-print" style={{ fontFamily: 'Nunito, sans-serif', color: TINTA }}>
      {/* ── Portada ─────────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden px-8 pb-6 pt-7 text-white"
        style={{ background: `linear-gradient(135deg,${TEAL_OSCURO} 0%,${TEAL} 58%,#00b4c5 100%)` }}
      >
        {/* Un círculo apenas visible: le quita la sensación de banda plana. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: '-70px',
            top: '-90px',
            width: '250px',
            height: '250px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,.07)',
          }}
        />

        <div className="relative flex items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-[.22em] text-white/55">
              {viaje.trip_no ? `${viaje.trip_no} · ` : ''}Itinerario de viaje
            </div>
            <h1 className="mt-1 font-heading text-[27px] font-extrabold leading-tight">
              {viaje.titulo}
            </h1>
            {(viaje.destino || viaje.pais) && (
              <div className="mt-1 text-[13px] text-white/80">
                {[viaje.destino, viaje.pais].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <img
            src={logoColor}
            alt="Arriaza Tour &amp; Travel"
            style={{ height: '40px', filter: 'brightness(0) invert(1)', flexShrink: 0 }}
          />
        </div>

        {/* Los cuatro datos que se buscan primero. */}
        <div className="relative mt-6 grid grid-cols-4 gap-2">
          <Dato rotulo="Salida" valor={fmtDate(viaje.fecha_ini)} />
          <Dato rotulo="Regreso" valor={fmtDate(viaje.fecha_fin)} />
          <Dato
            rotulo="Duración"
            valor={days.length ? `${days.length} días` : '—'}
            pie={noches > 0 ? `${noches} noche${noches > 1 ? 's' : ''}` : undefined}
          />
          <Dato rotulo="Servicios" valor={String(totalServicios)} />
        </div>
      </header>

      {(viaje.acompanantes || viaje.proposito) && (
        <div
          className="flex flex-wrap gap-x-10 gap-y-2 px-8 py-3"
          style={{ backgroundColor: '#f7f4ec', borderBottom: `1px solid ${ARENA_LINEA}` }}
        >
          {viaje.acompanantes && (
            <div className="min-w-0">
              <div
                className="text-[9px] font-extrabold uppercase tracking-[.16em]"
                style={{ color: TINTA_SUAVE }}
              >
                Viajan
              </div>
              <div className="text-[12px] font-semibold">{viaje.acompanantes}</div>
            </div>
          )}
          {viaje.proposito && (
            <div className="min-w-0">
              <div
                className="text-[9px] font-extrabold uppercase tracking-[.16em]"
                style={{ color: TINTA_SUAVE }}
              >
                Motivo
              </div>
              <div className="text-[12px] font-semibold">{viaje.proposito}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Los días ────────────────────────────────────────────────── */}
      <div className="px-8 py-6">
        {days.length === 0 && (
          <p className="text-sm italic" style={{ color: TINTA_SUAVE }}>
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

      <footer
        className="px-8 py-3 text-center text-[10px] font-extrabold uppercase tracking-[.2em] text-white/50"
        style={{ backgroundColor: TEAL_OSCURO }}
      >
        Arriaza Tour &amp; Travel
      </footer>
    </div>
  );
}

/** Una celda de la portada. */
function Dato({ rotulo, valor, pie }: { rotulo: string; valor: string; pie?: string }) {
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{ backgroundColor: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)' }}
    >
      <div className="text-[9px] font-extrabold uppercase tracking-[.16em] text-white/55">
        {rotulo}
      </div>
      <div className="mt-0.5 font-heading text-[14px] font-extrabold leading-tight">{valor}</div>
      {pie && <div className="text-[10px] text-white/55">{pie}</div>}
    </div>
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
  viajeId,
  dia,
  fecha,
  planId,
  lugar,
  filas,
  nota,
  servicios,
  canEdit,
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
      ...servicios.map((e, k) => ({
        tipo: 'servicio' as const,
        hora: e.hora,
        k: `s-${k}`,
        evento: e,
      })),
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
    <article className="evitar-corte mb-4 last:mb-0">
      {/* Banda del día · el número grande es lo que deja hojear el documento. */}
      <header
        className="flex items-center gap-3 rounded-t-lg px-4 py-2.5"
        style={{ backgroundColor: TEAL_OSCURO }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-heading text-[15px] font-extrabold text-white"
          style={{ backgroundColor: TEAL }}
        >
          {dia}
        </span>
        <div className="min-w-0">
          <div className="text-[9px] font-extrabold uppercase tracking-[.2em] text-white/50">
            Día {dia}
          </div>
          <div className="font-heading text-[13px] font-extrabold text-white first-letter:uppercase">
            {fmtDateLong(fecha)}
          </div>
        </div>
        {lugar && (
          <span
            className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold text-white/85"
            style={{ backgroundColor: 'rgba(255,255,255,.14)' }}
          >
            {lugar}
          </span>
        )}
      </header>

      <div
        className="rounded-b-lg px-5 py-4"
        style={{ border: `1px solid ${ARENA_LINEA}`, borderTop: 'none', backgroundColor: '#fff' }}
      >
        {renglones.map((r, idx) => {
          const ultimo = idx === renglones.length - 1 && !nota;
          const meta = r.tipo === 'servicio' ? SERVICE_META[r.evento.servicio] : MANUAL;
          const horaVisible = hhmm(r.tipo === 'servicio' ? r.evento.hora : r.fila.horario);

          return (
            <div key={r.k} className="flex gap-3">
              {/* Hora */}
              <div
                className="w-[46px] shrink-0 pt-1.5 text-right font-heading text-[11px] font-extrabold"
                style={{ color: horaVisible ? meta.dark : '#bdb5a6' }}
              >
                {horaVisible || '—'}
              </div>

              {/* Riel con el punto */}
              <div className="relative w-3 shrink-0">
                {!ultimo && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '5px',
                      top: '8px',
                      bottom: '-4px',
                      width: '2px',
                      backgroundColor: RIEL,
                    }}
                  />
                )}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '7px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: meta.solid,
                    border: '2px solid #ffffff',
                    boxShadow: `0 0 0 1.5px ${meta.solid}`,
                  }}
                />
              </div>

              {/* Contenido */}
              <div className="min-w-0 flex-1 pb-3">
                {r.tipo === 'servicio' ? (
                  <div
                    className="rounded-md px-3 py-2"
                    style={{
                      backgroundColor: SERVICE_META[r.evento.servicio].light,
                      borderLeft: `3px solid ${SERVICE_META[r.evento.servicio].solid}`,
                    }}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[12px]">{SERVICE_META[r.evento.servicio].icon}</span>
                      <span
                        className="text-[12px] font-extrabold"
                        style={{ color: SERVICE_META[r.evento.servicio].dark }}
                      >
                        {r.evento.titulo}
                      </span>
                    </div>
                    {r.evento.detalle && (
                      <div className="mt-0.5 text-[11px]" style={{ color: TINTA_SUAVE }}>
                        {r.evento.detalle}
                      </div>
                    )}
                  </div>
                ) : (
                  <FilaManual
                    fila={r.fila}
                    canEdit={canEdit}
                    onEditar={editar}
                    onBorrar={() =>
                      void borrarFila.mutateAsync({ id: r.fila.id, dayPlanId: planId as string })
                    }
                  />
                )}
              </div>
            </div>
          );
        })}

        {nota && (
          <div
            className="rounded-md px-3 py-2"
            style={{ backgroundColor: '#f5f0d8', borderLeft: '3px solid #9e7a1a' }}
          >
            <div
              className="text-[9px] font-extrabold uppercase tracking-[.16em]"
              style={{ color: '#7a5e14' }}
            >
              Nota del día
            </div>
            <div className="mt-0.5 whitespace-pre-wrap text-[11px]" style={{ color: TINTA }}>
              {nota}
            </div>
          </div>
        )}

        {vacio && (
          <p className="py-1 text-[11px] italic" style={{ color: '#b3aa9a' }}>
            Día libre.
          </p>
        )}

        {/* Agregar actividad · el "rellenar lo que haga falta" del documento. */}
        {canEdit && (
          <div className="no-print mt-2 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: ARENA_LINEA }}>
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

/**
 * Una actividad escrita a mano.
 *
 * Con permiso de edición se escribe en su casilla, pero esa casilla lleva
 * `no-print`: en papel sale el espejo estático de al lado, sin bordes ni la ✕.
 * El documento se le entrega al cliente y no puede ir con los controles de
 * quien lo armó.
 */
function FilaManual({
  fila,
  canEdit,
  onEditar,
  onBorrar,
}: {
  fila: FilaPlan;
  canEdit: boolean;
  onEditar: (f: FilaPlan, campo: 'horario' | 'itinerario', valor: string) => void;
  onBorrar: () => void;
}) {
  const cuerpo = (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[12px] font-semibold" style={{ color: MANUAL.dark }}>
        {fila.itinerario ?? '—'}
      </span>
      {fila.es_auto_reunion && (
        <span
          className="rounded-full px-1.5 text-[9px] font-extrabold uppercase"
          style={{ backgroundColor: '#ece3f2', color: '#5a3472' }}
        >
          reunión
        </span>
      )}
    </div>
  );

  if (!canEdit) {
    return (
      <div
        className="rounded-md px-3 py-2"
        style={{ backgroundColor: MANUAL.light, borderLeft: `3px solid ${MANUAL.solid}` }}
      >
        {cuerpo}
      </div>
    );
  }

  return (
    <>
      <div
        className="print-only rounded-md px-3 py-2"
        style={{ backgroundColor: MANUAL.light, borderLeft: `3px solid ${MANUAL.solid}` }}
      >
        {cuerpo}
      </div>

      <div className="no-print flex items-center gap-2">
        <input
          type="time"
          defaultValue={fila.horario ?? ''}
          onBlur={(ev) => onEditar(fila, 'horario', ev.target.value)}
          className="w-24 shrink-0 rounded border border-sand bg-white px-1 py-1 text-[11px] font-extrabold text-teal-d"
        />
        <input
          type="text"
          defaultValue={fila.itinerario ?? ''}
          onBlur={(ev) => onEditar(fila, 'itinerario', ev.target.value)}
          className="min-w-0 flex-1 rounded border border-sand bg-white px-2 py-1 text-[12px]"
          style={{ color: MANUAL.dark }}
        />
        {fila.es_auto_reunion && (
          <span
            className="shrink-0 rounded-full px-1.5 text-[9px] font-extrabold uppercase"
            style={{ backgroundColor: '#ece3f2', color: '#5a3472' }}
          >
            reunión
          </span>
        )}
        <button
          type="button"
          onClick={onBorrar}
          className="shrink-0 text-dark-3 hover:text-rust"
          aria-label="Quitar actividad"
        >
          ✕
        </button>
      </div>
    </>
  );
}
