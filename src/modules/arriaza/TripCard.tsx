import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fmtDate, autoTripStatus, autoStatusLabel } from './utils';
import { findCountry } from './constants/countries';
import { ManualStatusSelect } from './shared/ManualStatusSelect';
import { SERVICE_META, SERVICE_KEYS_MENU, type ServiceKey, type ManualStatus } from './constants/serviceMeta';
import type { AttViaje } from './viajes/api';
import { useServiceCounts } from './viajes/service-counts';
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
import { ActividadesSection } from './actividades/ActividadesSection';
import { ItineraryModal } from './ItineraryModal';
import { ShareModal } from './ShareModal';

// Servicios con Section implementada — TODAS las 14 disponibles.
const READY_SERVICES: ReadonlySet<ServiceKey> = new Set<ServiceKey>([
  'tickets', 'hotel', 'restaurantes', // F19-3c
  'tiendas', 'ruta', 'poi', 'reunion', // F19-3d bloque 1
  'tours', 'aeronave', 'renta', // F19-3d bloque 2
  'acuatico', 'ferry', 'terrestre', // F19-3d bloque 3
  'actividades', // F19-3d bloque 4
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
  const [addPos, setAddPos] = useState<{ top: number; left: number } | null>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [itinOpen, setItinOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // autoOpenKey: al hacer click en "+ Agregar Servicios > X", la Section de X
  // abre su modal "Nueva" automáticamente.
  const [autoOpenKey, setAutoOpenKey] = useState<ServiceKey | null>(null);
  // Qué secciones se muestran. Antes se apilaban las 14 de golpe y saturaban
  // la pantalla; ahora solo salen las que ya tienen registros y las que el
  // usuario abre a mano desde "+ Agregar Servicios".
  const [abiertos, setAbiertos] = useState<ReadonlySet<ServiceKey>>(new Set());
  const counts = useServiceCounts(viaje.id, servicesOpen);

  const visibles = useMemo(() => {
    const s = new Set<ServiceKey>(abiertos);
    for (const k of Object.keys(counts.data ?? {}) as ServiceKey[]) s.add(k);
    return s;
  }, [abiertos, counts.data]);

  // Posicionar dropdown "+ Agregar Servicios" en coordenadas viewport (Portal
  // escapa del overflow-hidden del article para que el menú no quede clippeado).
  useEffect(() => {
    if (!addOpen) return;
    const rect = addBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const menuW = 288; // w-72
      let left = rect.left;
      if (left + menuW > window.innerWidth - 12) left = window.innerWidth - menuW - 12;
      setAddPos({ top: rect.bottom + 4, left });
    }
    // Click fuera cierra.
    const onDoc = (e: MouseEvent) => {
      if (addBtnRef.current?.contains(e.target as Node)) return;
      const menu = document.getElementById('tt-addserv-menu');
      if (menu?.contains(e.target as Node)) return;
      setAddOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [addOpen]);

  const auto = autoTripStatus(viaje);
  const country = findCountry(viaje.pais);
  const flag = country?.flag ?? '📍';
  const manualStatus = (viaje.manual_status ?? 'Solicitado') as ManualStatus;

  function handleSelectService(key: ServiceKey) {
    setAddOpen(false);
    if (READY_SERVICES.has(key)) {
      setServicesOpen(true);
      setAbiertos((s) => new Set(s).add(key));
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
          <div className="mt-1 flex gap-1">
            <button
              type="button"
              onClick={() => setItinOpen(true)}
              title="Itinerario"
              className="rounded-md border border-sand px-2 py-1 text-[11px] hover:border-teal hover:bg-teal-l"
            >
              📋
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              title="Compartir por WhatsApp"
              className="rounded-md border border-sand px-2 py-1 text-[11px] hover:border-teal hover:bg-teal-l"
            >
              📲
            </button>
            {canEdit && (
              <>
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
              </>
            )}
          </div>
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
            <>
              <button
                ref={addBtnRef}
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                className="rounded-md border border-teal/40 bg-white px-3 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
              >
                + Agregar Servicios
              </button>
              {addOpen && addPos && createPortal(
                <div
                  id="tt-addserv-menu"
                  style={{ position: 'fixed', top: addPos.top, left: addPos.left, width: 288 }}
                  className="z-50 max-h-80 overflow-y-auto rounded-lg border border-sand bg-white p-1 shadow-2xl"
                >
                  {SERVICE_KEYS_MENU.map((k) => {
                    const meta = SERVICE_META[k];
                    const isReady = READY_SERVICES.has(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleSelectService(k)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-xs font-semibold text-dark-2 hover:bg-teal-l"
                      >
                        <span>{meta.icon} {meta.label}</span>
                        {!isReady && (
                          <span className="rounded-full bg-gold-light px-2 py-0.5 text-[9px] font-extrabold uppercase text-gold">
                            Pronto
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>,
                document.body,
              )}
            </>
          )}
        </div>

        {servicesOpen && (
          <div className="mt-3 space-y-4">
            {/* Solo se monta la sección de un servicio si ya tiene registros o
                si el usuario acaba de elegirlo. Montarlas todas saturaba la
                pantalla y era el reclamo #1 del usuario. */}
            {counts.isLoading && (
              <p className="text-xs text-dark-3">Revisando servicios…</p>
            )}
            {!counts.isLoading && visibles.size === 0 && (
              <p className="text-xs italic text-dark-3">
                Sin servicios agregados todavía. Usa “+ Agregar Servicios”.
              </p>
            )}
            {visibles.has('tickets') && (
              <TicketsSection
                viajeId={viaje.id}
                canEdit={canEdit}
                tripNo={viaje.trip_no}
                autoOpenCreate={autoOpenKey === 'tickets'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('hotel') && <HotelesSection viajeId={viaje.id} canEdit={canEdit} />}
            {visibles.has('restaurantes') && (
              <RestaurantesSection viajeId={viaje.id} canEdit={canEdit} />
            )}
            {visibles.has('renta') && (
              <RentasSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'renta'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('tours') && (
              <ToursSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'tours'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('aeronave') && (
              <AeronavesSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'aeronave'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('acuatico') && (
              <AcuaticosSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'acuatico'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('ferry') && (
              <FerriesSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'ferry'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('terrestre') && (
              <TerrestresSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'terrestre'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('actividades') && (
              <ActividadesSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'actividades'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('tiendas') && (
              <TiendasSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'tiendas'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('reunion') && (
              <ReunionesSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'reunion'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('ruta') && (
              <RutasSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'ruta'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
            {visibles.has('poi') && (
              <PoisSection
                viajeId={viaje.id}
                canEdit={canEdit}
                autoOpenCreate={autoOpenKey === 'poi'}
                onDidOpenCreate={() => setAutoOpenKey(null)}
              />
            )}
          </div>
        )}
      </div>
      <ItineraryModal open={itinOpen} onClose={() => setItinOpen(false)} viaje={viaje} />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} viaje={viaje} />
    </article>
  );
}
