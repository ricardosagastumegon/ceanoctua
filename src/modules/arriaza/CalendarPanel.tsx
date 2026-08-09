import { useMemo, useState } from 'react';
import type { AttViaje } from './viajes/api';

type Props = {
  viajes: AttViaje[];
  onDayClick?: (dateStr: string, viajesEseDia: AttViaje[]) => void;
};

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// Calendar lateral · paridad con el calendario del HTML standalone.
// Marca los días con viajes: trip-start (día de inicio), trip-mid (durante),
// trip-end (día de fin). Click en día muestra los viajes de ese día.
export function CalendarPanel({ viajes, onDayClick }: Props) {
  const [current, setCurrent] = useState(() => {
    // Auto-pick: mes del viaje activo/próximo más cercano; sino mes actual.
    const today = new Date().toISOString().slice(0, 10);
    const active = viajes.find(
      (v) => v.fecha_ini && v.fecha_fin && v.fecha_ini <= today && v.fecha_fin >= today,
    );
    const upcoming = viajes
      .filter((v) => v.fecha_ini && v.fecha_ini > today)
      .sort((a, b) => (a.fecha_ini ?? '').localeCompare(b.fecha_ini ?? ''))[0];
    const pick = active ?? upcoming;
    if (pick?.fecha_ini) {
      const d = new Date(pick.fecha_ini + 'T00:00:00');
      return { y: d.getFullYear(), m: d.getMonth() };
    }
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  const cells = useMemo(() => generateGrid(current.y, current.m, viajes), [current, viajes]);
  const todayStr = new Date().toISOString().slice(0, 10);

  function nav(delta: number) {
    const d = new Date(current.y, current.m + delta, 1);
    setCurrent({ y: d.getFullYear(), m: d.getMonth() });
  }

  function handleDayClick(cell: DayCell) {
    if (cell.otherMonth) return;
    onDayClick?.(cell.dateStr, cell.viajes);
  }

  return (
    <div className="overflow-hidden rounded-card border border-sand bg-white shadow-sm">
      <header className="flex items-center justify-between bg-gradient-to-br from-navy to-teal-d px-3 py-2 text-white">
        <div className="text-xs font-extrabold uppercase tracking-wider">📅 Calendario</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="rounded-md border border-white/20 bg-white/10 px-1.5 text-xs font-extrabold hover:bg-white/20"
            title="Mes anterior"
          >‹</button>
          <span className="min-w-[100px] text-center text-xs font-extrabold capitalize">
            {MESES[current.m]} {current.y}
          </span>
          <button
            type="button"
            onClick={() => nav(1)}
            className="rounded-md border border-white/20 bg-white/10 px-1.5 text-xs font-extrabold hover:bg-white/20"
            title="Mes siguiente"
          >›</button>
        </div>
      </header>
      <div className="grid grid-cols-7 bg-teal-l/60 text-[10px] font-extrabold uppercase tracking-wider text-teal-d">
        {DIAS.map((d, i) => <div key={i} className="py-1 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-sand">
        {cells.map((c, i) => {
          const isToday = c.dateStr === todayStr;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDayClick(c)}
              disabled={c.otherMonth}
              title={c.viajes.length > 0 ? c.viajes.map((v) => v.titulo).join(', ') : undefined}
              className={[
                'aspect-square min-h-[26px] text-[10px] font-semibold transition-colors',
                c.otherMonth ? 'bg-sand-l text-dark-3/40' : 'bg-white text-dark-2 hover:bg-teal-l',
                c.status === 'start' ? 'bg-gradient-to-br from-teal to-aqua font-extrabold text-white' : '',
                c.status === 'end' ? 'bg-gradient-to-br from-rust to-coral font-extrabold text-white' : '',
                c.status === 'mid' ? 'bg-teal/20 font-extrabold text-teal-d' : '',
                isToday ? 'ring-2 ring-inset ring-aqua' : '',
              ].join(' ')}
            >
              {c.day}
            </button>
          );
        })}
      </div>
      <footer className="flex flex-wrap gap-2 border-t border-sand/50 bg-white px-2 py-1.5 text-[9px] font-semibold text-dark-3">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-gradient-to-br from-teal to-aqua" />Inicio</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-teal/20" />En viaje</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-gradient-to-br from-rust to-coral" />Fin</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm ring-2 ring-aqua" />Hoy</span>
      </footer>
    </div>
  );
}

// ============================================================
// Grid generation
// ============================================================
type DayCell = {
  day: number;
  dateStr: string;
  otherMonth: boolean;
  status: 'start' | 'mid' | 'end' | null;
  viajes: AttViaje[];
};

function generateGrid(y: number, m: number, viajes: AttViaje[]): DayCell[] {
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();
  const cells: DayCell[] = [];

  // Días del mes previo (relleno inicial).
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrev - i,
      dateStr: '',
      otherMonth: true,
      status: null,
      viajes: [],
    });
  }
  // Días del mes actual.
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    let status: DayCell['status'] = null;
    const viajesDia: AttViaje[] = [];
    for (const v of viajes) {
      if (!v.fecha_ini || !v.fecha_fin) continue;
      if (dateStr === v.fecha_ini) { status = status === 'end' ? 'start' : (status ?? 'start'); viajesDia.push(v); }
      else if (dateStr === v.fecha_fin) { status = status === 'start' ? 'start' : 'end'; viajesDia.push(v); }
      else if (dateStr > v.fecha_ini && dateStr < v.fecha_fin) { status = status ?? 'mid'; viajesDia.push(v); }
    }
    cells.push({ day: d, dateStr, otherMonth: false, status, viajes: viajesDia });
  }
  // Relleno trailing hasta múltiplo de 7.
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    cells.push({ day: i, dateStr: '', otherMonth: true, status: null, viajes: [] });
  }
  return cells;
}
