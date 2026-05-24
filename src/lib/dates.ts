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
