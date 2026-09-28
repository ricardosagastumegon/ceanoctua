import { useQuery } from '@tanstack/react-query';
import { cargosApi } from './api';
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
