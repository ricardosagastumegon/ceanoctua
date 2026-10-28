import { useQuery } from '@tanstack/react-query';
import { cargosApi, sumaCargos } from './api';
import type { ServiceKey } from '../constants/serviceMeta';

export const cargosServicioKey = (tipo: string, id: string) => ['att_cargos', tipo, id] as const;
export const cargosViajeKey = (viajeId: string) => ['att_cargos', 'viaje', viajeId] as const;

export function useCargosServicio(tipo: ServiceKey, servicioId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: cargosServicioKey(tipo, servicioId ?? ''),
    enabled: !!servicioId && enabled,
    queryFn: () => cargosApi.byServicio(tipo, servicioId as string),
  });
}

export function useCargosViaje(viajeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: cargosViajeKey(viajeId ?? ''),
    enabled: !!viajeId && enabled,
    queryFn: () => cargosApi.byViaje(viajeId as string),
  });
}

/**
 * Cuánto se le cargó aparte a un servicio, en un número.
 *
 * Lo usan las hojas imprimibles: el `monto` del servicio ya no incluye los
 * cargos adicionales, así que sin esto el papel decía menos que la pantalla.
 */
export function useTotalCargos(
  tipo: ServiceKey,
  servicioId: string | undefined,
  enabled = true,
): number {
  const { data } = useCargosServicio(tipo, servicioId, enabled);
  return sumaCargos(data ?? []);
}
