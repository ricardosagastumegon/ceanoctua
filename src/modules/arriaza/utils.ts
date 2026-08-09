// Utilidades compartidas del módulo T&T · paridad con ttFmtDate/ttMoney/ttTripStatus/etc del HTML.

export type AutoTripStatus = 'proximo' | 'curso' | 'finalizado';

export function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(parts[2], 10)} ${meses[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

export function fmtMoney(v?: number | string | null, sym = 'US$'): string {
  const n = parseFloat(String(v ?? 0));
  return `${sym} ${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function autoTripStatus(t: { fecha_ini?: string | null; fecha_fin?: string | null }): AutoTripStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (!t.fecha_ini || !t.fecha_fin) return 'proximo';
  if (today < t.fecha_ini) return 'proximo';
  if (today > t.fecha_fin) return 'finalizado';
  return 'curso';
}

export function autoStatusLabel(s: AutoTripStatus): string {
  return ({ proximo: 'Próximo', curso: 'En curso', finalizado: 'Finalizado' } as const)[s];
}

// Normaliza texto para búsqueda sin acentos (ttNormTxt).
export function normTxt(s: string | null | undefined): string {
  return (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Slugifica un nombre para archivos descargables (ttSlug).
export function slug(s: string | null | undefined): string {
  return (s ?? 'viaje')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

// Nombre largo del día de la semana en español.
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function fmtDateLong(d?: string | null): string {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return `${DIAS_LARGO[dt.getDay()]} ${dt.getDate()} de ${MESES_LARGO[dt.getMonth()]} ${dt.getFullYear()}`;
}

// Cantidad de noches entre 2 fechas ISO.
export function calcNoches(checkin?: string | null, checkout?: string | null): number {
  if (!checkin || !checkout) return 0;
  const ms = new Date(checkout).getTime() - new Date(checkin).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

// Días entre inicio y fin de viaje (inclusivo, Día 1 = fecha_ini).
export function calcTripDays(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

// Genera la secuencia de fechas ISO entre start y end (inclusivo).
export function tripDateRange(start?: string | null, end?: string | null): string[] {
  if (!start || !end) return [];
  const out: string[] = [];
  const cursor = new Date(start + 'T00:00:00');
  const endD = new Date(end + 'T00:00:00');
  while (cursor <= endD) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
