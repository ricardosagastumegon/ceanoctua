import { useEffect, useState } from 'react';
import { formatDate, formatTime } from '@/lib/dates';

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="text-right leading-tight">
      <div className="text-sm font-medium text-sand-l">{formatTime(now)}</div>
      <div className="text-xs text-sand">{formatDate(now)}</div>
    </div>
  );
}
