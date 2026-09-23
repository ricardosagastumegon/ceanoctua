import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SERVICE_META, SERVICE_KEYS_MENU, type ServiceKey } from './constants/serviceMeta';
import { useServiceSummary } from './viajes/service-counts';
import type { AttViaje } from './viajes/api';
import { TicketsSection } from './tickets/TicketsSection';
import { HotelesSection } from './hoteles/HotelesSection';
import { RestaurantesSection } from './restaurantes/RestaurantesSection';
import { RentasSection } from './rentas/RentasSection';
import { TiendasSection } from './tiendas/TiendasSection';
import { RutasSection } from './rutas/RutasSection';
import { PoisSection } from './pois/PoisSection';
import { ReunionesSection } from './reuniones/ReunionesSection';
import { ToursSection } from './tours/ToursSection';
import { AeronavesSection } from './aeronaves/AeronavesSection';
import { AcuaticosSection } from './acuaticos/AcuaticosSection';
import { FerriesSection } from './ferries/FerriesSection';
import { TerrestresSection } from './terrestres/TerrestresSection';
import { ActividadesSection } from './actividades/ActividadesSection';

/** Servicios cuya UI ya está construida. Los demás avisan que vienen luego. */
const READY_SERVICES: ReadonlySet<ServiceKey> = new Set<ServiceKey>([
  'tickets', 'hotel', 'restaurantes', 'renta', 'tours', 'aeronave',
  'acuatico', 'ferry', 'terrestre', 'actividades', 'reunion',
  'tiendas', 'ruta', 'poi',
]);

type Props = { viaje: AttViaje; canEdit: boolean };

/**
 * El "carrito" del viaje: el menú para agregar servicios y las secciones de los
 * que ya tienen algo.
 *
 * Vive aquí y no en la tarjeta del dashboard porque el viaje ahora se
 * construye en su propia pantalla. Una sección se monta solo si su servicio ya
 * tiene registros o si el usuario acaba de elegirlo del menú — montar las once
 * a la vez saturaba la pantalla.
 */
export function TripServicesPanel({ viaje, canEdit }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [addPos, setAddPos] = useState<{ top: number; left: number } | null>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [autoOpenKey, setAutoOpenKey] = useState<ServiceKey | null>(null);
  const [abiertos, setAbiertos] = useState<ReadonlySet<ServiceKey>>(new Set());
  const resumen = useServiceSummary(viaje.id, true);

  const visibles = useMemo(() => {
    const s = new Set<ServiceKey>(abiertos);
    for (const k of Object.keys(resumen.data?.counts ?? {}) as ServiceKey[]) s.add(k);
    return s;
  }, [abiertos, resumen.data]);

  // El menú sale por portal: `position: absolute` quedaría recortado por el
  // contenedor con overflow del panel.
  useEffect(() => {
    if (!addOpen) return;
    const rect = addBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const menuW = 288;
      let left = rect.left;
      if (left + menuW > window.innerWidth - 12) left = window.innerWidth - menuW - 12;
      setAddPos({ top: rect.bottom + 4, left });
    }
    const onDoc = (e: MouseEvent) => {
      if (addBtnRef.current?.contains(e.target as Node)) return;
      if (document.getElementById('tt-addserv-menu')?.contains(e.target as Node)) return;
      setAddOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [addOpen]);

  function handleSelectService(key: ServiceKey) {
    setAddOpen(false);
    if (!READY_SERVICES.has(key)) return;
    setAbiertos((s) => new Set(s).add(key));
    setAutoOpenKey(key);
  }

  const comunes = {
    viajeId: viaje.id,
    canEdit,
    tripNo: viaje.trip_no,
    onDidOpenCreate: () => setAutoOpenKey(null),
  };

  return (
    <section className="rounded-card border border-sand bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-extrabold text-dark">
          Servicios del viaje
          {resumen.data && Object.keys(resumen.data.counts).length > 0 && (
            <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-[11px] font-bold text-dark-2">
              {Object.values(resumen.data.counts).reduce((a, b) => a + b, 0)}
            </span>
          )}
        </h2>
        {canEdit && (
          <>
            <button
              ref={addBtnRef}
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="rounded-md bg-teal px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-d"
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
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleSelectService(k)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-semibold hover:bg-sand-l"
                      style={{ color: meta.dark }}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>,
              document.body,
            )}
          </>
        )}
      </div>

      <div className="space-y-5">
        {resumen.isLoading && <p className="text-xs text-dark-3">Revisando servicios…</p>}
        {!resumen.isLoading && visibles.size === 0 && (
          <p className="text-sm italic text-dark-3">
            Sin servicios agregados todavía. Usa “+ Agregar Servicios” para empezar a armar el viaje.
          </p>
        )}

        {visibles.has('tickets') && <TicketsSection {...comunes} autoOpenCreate={autoOpenKey === 'tickets'} />}
        {visibles.has('hotel') && <HotelesSection {...comunes} autoOpenCreate={autoOpenKey === 'hotel'} />}
        {visibles.has('restaurantes') && <RestaurantesSection {...comunes} autoOpenCreate={autoOpenKey === 'restaurantes'} />}
        {visibles.has('renta') && <RentasSection {...comunes} autoOpenCreate={autoOpenKey === 'renta'} />}
        {visibles.has('tours') && <ToursSection {...comunes} autoOpenCreate={autoOpenKey === 'tours'} />}
        {visibles.has('aeronave') && <AeronavesSection {...comunes} autoOpenCreate={autoOpenKey === 'aeronave'} />}
        {visibles.has('acuatico') && <AcuaticosSection {...comunes} autoOpenCreate={autoOpenKey === 'acuatico'} />}
        {visibles.has('ferry') && <FerriesSection {...comunes} autoOpenCreate={autoOpenKey === 'ferry'} />}
        {visibles.has('terrestre') && <TerrestresSection {...comunes} autoOpenCreate={autoOpenKey === 'terrestre'} />}
        {visibles.has('actividades') && <ActividadesSection {...comunes} autoOpenCreate={autoOpenKey === 'actividades'} />}
        {visibles.has('reunion') && <ReunionesSection {...comunes} autoOpenCreate={autoOpenKey === 'reunion'} />}
        {/* Tiendas, Ruta y Puntos de Interés salieron del menú, pero si un
            viaje ya tiene alguno se sigue viendo y editando. */}
        {visibles.has('tiendas') && (
          <TiendasSection viajeId={viaje.id} canEdit={canEdit} autoOpenCreate={autoOpenKey === 'tiendas'} onDidOpenCreate={comunes.onDidOpenCreate} />
        )}
        {visibles.has('ruta') && (
          <RutasSection viajeId={viaje.id} canEdit={canEdit} autoOpenCreate={autoOpenKey === 'ruta'} onDidOpenCreate={comunes.onDidOpenCreate} />
        )}
        {visibles.has('poi') && (
          <PoisSection viajeId={viaje.id} canEdit={canEdit} autoOpenCreate={autoOpenKey === 'poi'} onDidOpenCreate={comunes.onDidOpenCreate} />
        )}
      </div>
    </section>
  );
}
