const dateFmt = new Intl.DateTimeFormat('es-GT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateLongFmt = new Intl.DateTimeFormat('es-GT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateShortFmt = new Intl.DateTimeFormat('es-GT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('es-GT', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? parseLocal(d) : d;
  return dateFmt.format(date);
}

export function formatDateLong(d: Date | string): string {
  const date = typeof d === 'string' ? parseLocal(d) : d;
  return dateLongFmt.format(date);
}

export function formatDateShort(d: Date | string): string {
  const date = typeof d === 'string' ? parseLocal(d) : d;
  return dateShortFmt.format(date);
}

export function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? parseLocal(d) : d;
  return timeFmt.format(date);
}

export function formatDateTime(d: Date | string): string {
  return `${formatDate(d)} ${formatTime(d)}`;
}

// Parse a YYYY-MM-DD (or ISO string) as local time to avoid TZ off-by-one.
function parseLocal(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

function toLocalMidnight(d: Date | string): Date {
  const date = typeof d === 'string' ? parseLocal(d) : new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  return date;
}

// Whole calendar days between today and the given date.
// Negative => date is in the past.
export function daysUntil(d: Date | string): number {
  const target = toLocalMidnight(d);
  const today = toLocalMidnight(new Date());
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / 86_400_000);
}

// Business days (Mon-Fri) between today and the given date.
// Returns negative if target is in the past. Excludes weekends; today => 0.
export function businessDaysUntil(d: Date | string): number {
  const target = toLocalMidnight(d);
  const today = toLocalMidnight(new Date());
  if (target.getTime() === today.getTime()) return 0;

  const direction = target > today ? 1 : -1;
  let count = 0;
  const cursor = new Date(today);
  while (cursor.getTime() !== target.getTime()) {
    cursor.setDate(cursor.getDate() + direction);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += direction;
  }
  return count;
}

// Add N business days to a date and return YYYY-MM-DD.
export function addBusinessDays(d: Date | string, n: number): string {
  const base = toLocalMidnight(d);
  let added = 0;
  const cursor = new Date(base);
  while (added < n) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, '0');
  const dd = String(cursor.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Bizdays left from today until target date.
// Matches the reference: -1 if past, else count of business days remaining.
export function bizDaysLeft(s: Date | string): number {
  const target = toLocalMidnight(s);
  const today = toLocalMidnight(new Date());
  if (target < today) return -1;
  if (target.getTime() === today.getTime()) return 0;
  let c = 0;
  const cur = new Date(today);
  while (cur < target) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) c++;
  }
  return c;
}

export type DueState = 'ok' | 'warn' | 'over' | 'done';

export function dueStateFor(targetDate: string | null, done = false, warnDays = 2): DueState {
  if (done) return 'done';
  if (!targetDate) return 'ok';
  const left = bizDaysLeft(targetDate);
  if (left < 0) return 'over';
  if (left <= warnDays) return 'warn';
  return 'ok';
}

export function dueBadgeText(targetDate: string | null, done = false): string {
  if (done) return '✓';
  if (!targetDate) return '';
  const left = bizDaysLeft(targetDate);
  if (left < 0) return 'VENCIDO';
  if (left === 0) return 'hoy';
  return `${left}d`;
}

export function isOverdue(d: Date | string | null | undefined): boolean {
  if (!d) return false;
  return daysUntil(d) < 0;
}

// Greeting based on current local hour.
export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// HH:MM (24h)
export function formatClockHHMM(d = new Date()): string {
  return timeFmt.format(d);
}
