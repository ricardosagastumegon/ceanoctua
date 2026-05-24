const dateFmt = new Intl.DateTimeFormat('es-GT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('es-GT', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return dateFmt.format(date);
}

export function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return timeFmt.format(date);
}

export function formatDateTime(d: Date | string): string {
  return `${formatDate(d)} ${formatTime(d)}`;
}

function toDate(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : new Date(d.getTime());
  // Normalize to local midnight to count whole days
  date.setHours(0, 0, 0, 0);
  return date;
}

// Whole calendar days between today and the given date.
// Negative => date is in the past.
export function daysUntil(d: Date | string): number {
  const target = toDate(d);
  const today = toDate(new Date());
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / 86_400_000);
}

// Business days (Mon-Fri) between today and the given date.
// Negative if target is in the past. Excludes weekends; today counts as 0.
// Does not account for local holidays.
export function businessDaysUntil(d: Date | string): number {
  const target = toDate(d);
  const today = toDate(new Date());
  if (target.getTime() === today.getTime()) return 0;

  const direction = target > today ? 1 : -1;
  let count = 0;
  const cursor = new Date(today);
  while (cursor.getTime() !== target.getTime()) {
    cursor.setDate(cursor.getDate() + direction);
    const day = cursor.getDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6) {
      count += direction;
    }
  }
  return count;
}

export function isOverdue(d: Date | string | null | undefined): boolean {
  if (!d) return false;
  return daysUntil(d) < 0;
}
