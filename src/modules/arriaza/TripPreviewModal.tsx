import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from './constants/serviceMeta';
import { findCountry } from './constants/countries';
import { fmtDate, fmtMoney } from './utils';
import { useResumenViaje } from './viajes/resumen';
import logoColor from './arriaza-logo-color.png';
import type { AttViaje } from './viajes/api';

type Props = {
  open: boolean;
  onClose: () => void;
  viaje: AttViaje | null;
  /** Abre el itinerario del viaje; lo maneja quien monta este modal. */
  onItinerario?: () => void;
};

const TEAL_OSCURO = '#0d2b2e';
const TEAL = '#077e84';

/**
 * Vista previa del viaje: todo lo que tiene, de un vistazo.
 *
 * Es lo que en el HTML original abría el botón «Ver» de la carpeta de viajes
 * realizados. Un viaje archivado se consulta más de lo que se edita, y abrir
 * la pantalla completa para recordar qué se hizo era demasiado.
 */
export function TripPreviewModal({ open, onClose, viaje, onItinerario }: Props) {
  const q = useResumenViaje(viaje?.id, open);
  const d = q.data;

  if (!viaje) return null;

  const noches =
    viaje.fecha_ini && viaje.fecha_fin
      ? Math.max(
          0,
          Math.round(
            (new Date(viaje.fecha_fin).getTime() - new Date(viaje.fecha_ini).getTime()) / 86400000,
          ),
        )
      : null;
  const bandera = findCountry(viaje.pais)?.flag ?? '';
  const monedaUnica = d && d.monedas.length === 1 ? d.monedas[0] : '';

  return (
    <Modal open={open} onClose={onClose} title={`Vista previa · ${viaje.titulo}`} size="xl">
      <div className="overflow-hidden rounded-card">
        {/* Portada */}
        <header
          className="relative overflow-hidden px-7 py-6 text-white"
          style={{ background: `linear-gradient(135deg,${TEAL_OSCURO} 0%,${TEAL} 62%,#00b4c5 100%)` }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: '-60px',
              top: '-80px',
              width: '220px',
              height: '220px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,.08)',
            }}
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/55">
                {viaje.trip_no ? `${viaje.trip_no} · ` : ''}Vista previa del viaje
              </div>
              <h2 className="mt-1 font-heading text-2xl font-extrabold leading-tight">
                {bandera && <span className="mr-1.5">{bandera}</span>}
                {viaje.titulo}
              </h2>
              <div className="mt-1 text-[12px] text-white/80">
                {[viaje.destino, viaje.pais].filter(Boolean).join(' · ') || '—'}
              </div>
              {viaje.manual_status && (
                <span
                  className="mt-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ backgroundColor: 'rgba(255,255,255,.18)' }}
                >
                  {viaje.manual_status}
                </span>
              )}
            </div>
            <img
              src={logoColor}
              alt="Arriaza Tour &amp; Travel"
              style={{ height: '34px', filter: 'brightness(0) invert(1)', flexShrink: 0 }}
            />
          </div>
        </header>

        {/* Los tres datos del encabezado */}
        <div className="grid gap-3 bg-sand-l px-7 py-4 sm:grid-cols-3">
          <Ficha
            rotulo="Fechas"
            valor={`${fmtDate(viaje.fecha_ini)} — ${fmtDate(viaje.fecha_fin)}`}
            pie={noches !== null && noches > 0 ? `${noches} noches` : undefined}
          />
          <Ficha rotulo="Participantes" valor={viaje.acompanantes || '—'} />
          <Ficha rotulo="Motivo" valor={viaje.proposito || '—'} />
        </div>

        {/* Los servicios */}
        <div className="bg-white px-7 py-5">
          <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-sand pb-1.5">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-teal-d">
              Servicios agregados
            </div>
            {d && d.servicios.length > 0 && (
              <div className="text-right">
                <div className="font-heading text-base font-extrabold text-dark">
                  {monedaUnica ? fmtMoney(d.total, `${monedaUnica} `) : fmtMoney(d.total)}
                </div>
                {d.sinMonto > 0 && (
                  <div className="text-[10px] text-dark-3">
                    parcial · {d.sinMonto} sin monto
                  </div>
                )}
              </div>
            )}
          </div>

          {q.isLoading && <p className="text-sm text-dark-3">Cargando servicios…</p>}

          {q.isError && (
            <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-sm text-rust">
              {describeError(q.error)}
              <button
                type="button"
                onClick={() => void q.refetch()}
                className="ml-2 rounded-md border border-rust px-2 py-0.5 text-xs font-semibold"
              >
                Reintentar
              </button>
            </div>
          )}

          {d && d.servicios.length === 0 && (
            <p className="text-sm italic text-dark-3">
              Aún no se han agregado servicios a este viaje.
            </p>
          )}

          <div className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
            {(d?.servicios ?? []).map((s, i) => {
              const meta = SERVICE_META[s.servicio];
              return (
                <div
                  key={`${s.servicio}-${i}`}
                  className="flex items-center gap-3 rounded-md px-3 py-2"
                  style={{
                    backgroundColor: meta.light,
                    borderLeft: `4px solid ${meta.solid}`,
                    opacity: s.cancelado ? 0.6 : 1,
                  }}
                >
                  <span className="shrink-0 text-sm">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="truncate text-[13px] font-extrabold"
                        style={{ color: meta.dark }}
                      >
                        {s.nombre}
                      </span>
                      {s.estadoPago && (
                        <span
                          className="shrink-0 rounded-full bg-white/70 px-1.5 text-[9px] font-extrabold uppercase"
                          style={{ color: meta.dark }}
                        >
                          {s.estadoPago}
                        </span>
                      )}
                      {s.cancelado && (
                        <span className="shrink-0 rounded-full bg-rust-l px-1.5 text-[9px] font-extrabold uppercase text-rust">
                          cancelado
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-dark-3">
                      {[meta.label, s.sub].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {s.monto > 0 && (
                    <div
                      className="shrink-0 whitespace-nowrap text-[13px] font-extrabold"
                      style={{ color: meta.solid }}
                    >
                      {fmtMoney(s.monto, `${s.moneda} `)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
        >
          Cerrar
        </button>
        {onItinerario && (
          <button
            type="button"
            onClick={onItinerario}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
          >
            📋 Itinerario final
          </button>
        )}
        <Link
          to={`/arriaza/viaje/${viaje.id}`}
          className="rounded-md bg-teal px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-d"
        >
          Abrir viaje
        </Link>
      </div>
    </Modal>
  );
}

function Ficha({ rotulo, valor, pie }: { rotulo: string; valor: string; pie?: string }) {
  return (
    <div className="rounded-md border border-sand bg-white px-3 py-2">
      <div className="text-[9px] font-extrabold uppercase tracking-[.16em] text-dark-3">
        {rotulo}
      </div>
      <div className="mt-0.5 text-[12px] font-semibold text-dark">{valor}</div>
      {pie && <div className="text-[10px] text-dark-3">{pie}</div>}
    </div>
  );
}
