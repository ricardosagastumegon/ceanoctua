import { useState } from 'react';
import { fmtDate, autoTripStatus, autoStatusLabel } from './utils';
import { findCountry } from './constants/countries';
import { ManualStatusSelect } from './shared/ManualStatusSelect';
import { SERVICE_META, SERVICE_KEYS, type ServiceKey, type ManualStatus } from './constants/serviceMeta';
import type { AttViaje } from './viajes/api';
import { TicketsSection } from './tickets/TicketsSection';
import { HotelesSection } from './hoteles/HotelesSection';
import { RestaurantesSection } from './restaurantes/RestaurantesSection';
import { TiendasSection } from './tiendas/TiendasSection';
import { RutasSection } from './rutas/RutasSection';
import { PoisSection } from './pois/PoisSection';
import { ReunionesSection } from './reuniones/ReunionesSection';
import { ToursSection } from './tours/ToursSection';
import { AeronavesSection } from './aeronaves/AeronavesSection';
import { RentasSection } from './rentas/RentasSection';
import { AcuaticosSection } from './acuaticos/AcuaticosSection';
import { FerriesSection } from './ferries/FerriesSection';
import { TerrestresSection } from './terrestres/TerrestresSection';

// Servicios con Section implementada (crece con cada bloque de F19-3d).
const READY_SERVICES: ReadonlySet<ServiceKey> = new Set<ServiceKey>([
  'tickets', 'hotel', 'restaurantes', // F19-3c
  'tiendas', 'ruta', 'poi', 'reunion', // F19-3d bloque 1
  'tours', 'aeronave', 'renta', // F19-3d bloque 2
  'acuatico', 'ferry', 'terrestre', // F19-3d bloque 3
]);

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

// Trip card estilo HTML — header con manual_status + acciones, body con servicios
// expandibles, dropdown "+ Agregar Servicios" con 14 opciones.
export function TripCard({ viaje, canEdit, onEdit, onDelete, onManualStatusChange }: Props) {
  const [servicesOpen, setServicesOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // autoOpenKey: al hacer click en "+ Agregar Servicios > X", la Section de X
  // abre su modal "Nueva" automáticamente. Todas las secciones se renderean
  // apiladas (sin sub-nav), así que solo hay que triggear la del servicio elegido.
  const [autoOpenKey, setAutoOpenKey] = useState<ServiceKey | null>(null);

  const auto = autoTripStatus(viaje);
  const country = findCountry(viaje.pais);
  const flag = country?.flag ?? '📍';
  const manualStatus = (viaje.manual_status ?? 'Solicitado') as ManualStatus;

  function handleSelectService(key: ServiceKey) {
    setAddOpen(false);
    if (READY_SERVICES.has(key)) {
      setServicesOpen(true);
      setAutoOpenKey(key);
    } else {
      // eslint-disable-next-line no-alert
      alert(
        `📌 "${SERVICE_META[key].label}" estará disponible en un próximo bloque de F19-3d.\n\n` +
          `El schema, API y hooks ya están listos — solo falta la UI del formulario.`,
      );
    }
  }

  return (
    <article
      className={`mb-3 overflow-hidden rounded-card border-l-4 bg-white shadow-sm transition-shadow hover:shadow-md ${AUTO_BORDER[auto]}`}
    >
      <header className="flex items-start justify-between gap-3 bg-gradient-to-r from-white to-teal-l/40 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-l text-lg">
            {flag}
          </span>
          <div className="min-w-0">
            {viaje.trip_no && (
              <div className="inline-block rounded-full bg-teal-l px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-teal-d">
                {viaje.trip_no}
              </div>
            )}
            <div className="font-heading text-base font-extrabold text-dark">{viaje.titulo}</div>
            <div className="mt-0.5 text-xs font-semibold text-dark-2">
              📍 {viaje.destino ?? viaje.ciudad ?? '—'}
              {viaje.pais ? ` · ${viaje.pais}` : ''}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-dark-3">
              📅 {fmtDate(viaje.fecha_ini)} — {fmtDate(viaje.fecha_fin)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${AUTO_BADGE[auto]}`}>
            {autoStatusLabel(auto)}
          </span>
          {canEdit && (
            <ManualStatusSelect value={manualStatus} onChange={onManualStatusChange} />
          )}
          {canEdit && (
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                onClick={onEdit}
                title="Editar"
                className="rounded-md border border-sand px-2 py-1 text-[11px] hover:border-teal hover:bg-teal-l"
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Eliminar"
                className="rounded-md border border-sand px-2 py-1 text-[11px] hover:border-rust hover:bg-rust-l"
              >
                🗑
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="px-4 py-3">
        {(viaje.acompanantes || viaje.proposito) && (
          <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-dark-2">
            {viaje.acompanantes && (
              <div>
                👥 <b>{viaje.acompanantes}</b>
              </div>
            )}
            {viaje.proposito && (
              <div>
                🎯 <b>{viaje.proposito}</b>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setServicesOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-extrabold text-teal-d"
          >
            <span
              className={`inline-block transition-transform ${servicesOpen ? 'rotate-90' : ''}`}
            >
              ▸
            </span>
            Servicios
          </button>

          {canEdit && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                className="rounded-md border border-teal/40 bg-white px-3 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
              >
                + Agregar Servicios
              </button>
              {addOpen && (
                <div className="absolute z-40 mt-1 max-h-80 w-72 overflow-y-auto rounded-lg border border-sand bg-white p-1 shadow-lg">
                  {SERVICE_KEYS.map((k) => {
                    const meta = SERVICE_META[k];
                    const isReady = READY_SERVICES.has(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleSelectService(k)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-xs font-semibold text-dark-2 hover:bg-teal-l"
                      >
                        <span>
                          {meta.icon} {meta.label}
                        </span>
                        {!isReady && (
                          <span className="rounded-full bg-gold-light px-2 py-0.5 text-[9px] font-extrabold uppercase text-gold">
                            Pronto
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {servicesOpen && (
          <div className="mt-3 space-y-4">
            {/* Todas las secciones se apilan (no hay sub-nav duplicado con
                "+ Agregar Servicios"). Cada Section muestra su lista o el
                empty state minimalista. autoOpenCreate abre el modal Nuevo
                cuando el usuario elige el servicio desde "+ Agregar Servicios". */}
            <TicketsSection viajeId={viaje.id} canEdit={canEdit} />
            <HotelesSection viajeId={viaje.id} canEdit={canEdit} />
            <RestaurantesSection viajeId={viaje.id} canEdit={canEdit} />
            <RentasSection
              viajeId={viaje.id}
              canEdit={canEdit}
              autoOpenCreate={autoOpenKey === 'renta'}
              onDidOpenCreate={() => setAutoOpenKey(null)}
            />
            <ToursSection
              viajeId={viaje.id}
              canEdit={canEdit}
              autoOpenCreate={autoOpenKey === 'tours'}
              onDidOpenCreate={() => setAutoOpenKey(null)}
            />
            <AeronavesSection
              viajeId={viaje.id}
              canEdit={canEdit}
              autoOpenCreate={autoOpenKey === 'aeronave'}
              onDidOpenCreate={() => setAutoOpenKey(null)}
            />
            <AcuaticosSection
              viajeId={viaje.id}
              canEdit={canEdit}
              autoOpenCreate={autoOpenKey === 'acuatico'}
              onDidOpenCreate={() => setAutoOpenKey(null)}
            />
            <FerriesSection
              viajeId={viaje.id}
              canEdit={canEdit}
              autoOpenCreate={autoOpenKey === 'ferry'}
              onDidOpenCreate={() => setAutoOpenKey(null)}
            />
            <TerrestresSection
              viajeId={viaje.id}
              canEdit={canEdit}
              autoOpenCreate={autoOpenKey === 'terrestre'}
              onDidOpenCreate={() => setAutoOpenKey(null)}
            />
            <TiendasSection
              viajeId={viaje.id}
              canEdit={canEdit}
              autoOpenCreate={autoOpenKey === 'tiendas'}
              onDidOpenCreate={() => setAutoOpenKey(null)}
            />
            <ReunionesSection
              viajeId={viaje.id}
              canEdit={canEdit}
              autoOpenCreate={autoOpenKey === 'reunion'}
              onDidOpenCreate={() => setAutoOpenKey(null)}
            />
            <RutasSection
              viajeId={viaje.id}
              canEdit={canEdit}
              autoOpenCreate={autoOpenKey === 'ruta'}
              onDidOpenCreate={() => setAutoOpenKey(null)}
            />
            <PoisSection
              viajeId={viaje.id}
              canEdit={canEdit}
              autoOpenCreate={autoOpenKey === 'poi'}
              onDidOpenCreate={() => setAutoOpenKey(null)}
            />
          </div>
        )}
      </div>
    </article>
  );
}
