import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateLong, greetingFor } from '@/lib/dates';

type Props = {
  userName?: string | null;
  activeTripsCount?: number;
};

export function DashboardHero({ userName, activeTripsCount = 0 }: Props) {
  const [now, setNow] = useState(() => new Date());
  const qc = useQueryClient();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <section className="rounded-card bg-gradient-to-br from-teal-d via-teal to-aqua p-6 text-white shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-heading text-lg font-medium text-white/80">
            {greetingFor(now)}{userName ? `, ${userName.split(' ')[0]}` : ''}
          </p>
          <p className="mt-1 text-sm text-white/70">
            {formatDateLong(now)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              ✈ {activeTripsCount} viaje{activeTripsCount === 1 ? '' : 's'} activo{activeTripsCount === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => void qc.invalidateQueries()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-white/20"
              title="Refrescar todo el dashboard"
            >
              ↻ Actualizar
            </button>
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-5xl font-bold tabular-nums leading-none tracking-tight">
            {hh}:{mm}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/70">Hora local</p>
        </div>
      </div>
    </section>
  );
}
