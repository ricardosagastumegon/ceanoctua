import { Link } from 'react-router-dom';
import { fmtDate, autoTripStatus, autoStatusLabel } from './utils';
import { ManualStatusSelect } from './shared/ManualStatusSelect';
import { useServiceSummary } from './viajes/service-counts';
import { SERVICE_META, type ManualStatus, type ServiceKey } from './constants/serviceMeta';
import type { AttViaje } from './viajes/api';

type Props = {
  viaje: AttViaje;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onManualStatusChange: (status: ManualStatus) => void;
};

const AUTO_BORDER: Record<ReturnType<typeof autoTripStatus>, string> = {
  proximo: 'border-l-gold',
  curso: 'border-l-aqua',
  finalizado: 'border-l-dark-3',
};
const AUTO_BADGE: Record<ReturnType<typeof autoTripStatus>, string> = {
  proximo: 'bg-gold-light text-gold',
  curso: 'bg-teal-l text-teal-d',
  finalizado: 'bg-sand-l text-dark-3',
};

/**
 * Tarjeta del viaje en el dashboard.
 *
 * Es un resumen y una puerta: el viaje se arma en su propia pantalla. Antes
 * desplegaba aquí mismo las secciones de servicios, lo que mezclaba ver la
 * lista de viajes con construir uno y saturaba el dashboard.
 */
export function TripCard({ viaje, canEdit, onEdit, onDelete, onManualStatusChange }: Props) {
  const auto = autoTripStatus(viaje);
  const manualStatus = (viaje.manual_status ?? 'Solicitado') as ManualStatus;
  // Comparte caché con la pantalla del viaje: es la misma query key.
  const resumen = useServiceSummary(viaje.id, true);
  const servicios = resumen.data?.counts ?? {};
  const totalServicios = Object.values(servicios).reduce((a, b) => a + b, 0);

  return (
    <article
      className={`mb-3 overflow-hidden rounded-card border-l-4 bg-white shadow-sm transition-shadow hover:shadow-md ${AUTO_BORDER[auto]}`}
    >
      <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-white to-teal-l/40 px-4 py-3">
        <Link to={`/arriaza/viaje/${viaje.id}`} className="group flex min-w-0 flex-1 items-start gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-l font-mono text-[11px] font-extrabold text-teal-d">
            {viaje.pais ? viaje.pais.slice(0, 2).toUpperCase() : '📍'}
          </span>
          <div className="min-w-0">
            {viaje.trip_no && (
              <div className="inline-block rounded-full bg-teal-l px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-teal-d">
                {viaje.trip_no}
              </div>
            )}
            <div className="font-heading text-base font-extrabold text-dark group-hover:text-teal-d">
              {viaje.titulo}
            </div>
            <div className="mt-0.5 text-xs font-semibold text-dark-2">
              📍 {viaje.destino ?? viaje.ciudad ?? '—'}
              {viaje.pais ? ` · ${viaje.pais}` : ''}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-dark-3">
              📅 {fmtDate(viaje.fecha_ini)} — {fmtDate(viaje.fecha_fin)}
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${AUTO_BADGE[auto]}`}>
            {autoStatusLabel(auto)}
          </span>
          {resumen.data && resumen.data.total > 0 && (
            <div className="text-right">
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-dark-3">
                Costo total
              </div>
              <div className="font-heading text-sm font-extrabold text-teal-d">
                {resumen.data.total.toFixed(2)}
              </div>
            </div>
          )}
          {canEdit && <ManualStatusSelect value={manualStatus} onChange={onManualStatusChange} />}
          {canEdit && (
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                onClick={onEdit}
                title="Editar viaje"
                className="rounded-md border border-sand px-2 py-1 text-[11px] hover:border-teal hover:bg-teal-l"
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Eliminar viaje"
                className="rounded-md border border-sand px-2 py-1 text-[11px] hover:border-rust hover:bg-rust-l"
              >
                🗑
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {(viaje.acompanantes || viaje.proposito) && (
          <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-dark-2">
            {viaje.acompanantes && <div>👥 <b>{viaje.acompanantes}</b></div>}
            {viaje.proposito && <div>🎯 <b>{viaje.proposito}</b></div>}
          </div>
        )}

        {/* Qué lleva el viaje, sin tener que abrirlo. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {totalServicios === 0 ? (
            <span className="text-[11px] italic text-dark-3">Sin servicios agregados todavía.</span>
          ) : (
            (Object.entries(servicios) as [ServiceKey, number][]).map(([key, n]) => {
              const meta = SERVICE_META[key];
              return (
                <span
                  key={key}
                  title={meta.label}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: meta.light, color: meta.dark }}
                >
                  {meta.icon} {n}
                </span>
              );
            })
          )}
        </div>

        <Link
          to={`/arriaza/viaje/${viaje.id}`}
          className="mt-3 inline-flex rounded-md bg-teal px-3 py-1.5 text-xs font-extrabold text-white hover:bg-teal-d"
        >
          Abrir viaje →
        </Link>
      </div>
    </article>
  );
}
