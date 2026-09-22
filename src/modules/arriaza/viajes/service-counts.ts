// Cuántos registros tiene cada servicio de un viaje.
//
// Para qué: la tarjeta no puede apilar los 11 servicios — satura la pantalla.
// Solo muestra los que ya tienen algo guardado, más el que el usuario abra a
// mano. Para saber cuáles tienen algo hace falta este conteo.
//
// Se pide `head: true`, así que la base devuelve solo el número y ningún dato.
// La consulta corre únicamente cuando el usuario despliega los servicios de un
// viaje (`enabled`), no al cargar el dashboard entero.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ServiceKey } from '../constants/serviceMeta';

const TABLA_POR_SERVICIO = {
  tickets: 'att_tickets',
  hotel: 'att_hoteles',
  restaurantes: 'att_restaurantes',
  renta: 'att_rentas',
  tours: 'att_tours',
  aeronave: 'att_aeronaves',
  acuatico: 'att_acuaticos',
  ferry: 'att_ferries',
  terrestre: 'att_terrestres',
  actividades: 'att_actividades',
  reunion: 'att_reuniones',
  tiendas: 'att_tiendas',
  ruta: 'att_rutas',
  poi: 'att_pois',
} as const satisfies Record<ServiceKey, string>;

export type ServiceCounts = Partial<Record<ServiceKey, number>>;

export function useServiceCounts(viajeId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['att_service_counts', viajeId],
    enabled: !!viajeId && enabled,
    queryFn: async (): Promise<ServiceCounts> => {
      const entries = Object.entries(TABLA_POR_SERVICIO) as [ServiceKey, string][];
      const results = await Promise.all(
        entries.map(async ([key, tabla]) => {
          const { count, error } = await supabase
            .from(tabla)
            .select('id', { count: 'exact', head: true })
            .eq('viaje_id', viajeId as string)
            .is('deleted_at', null);
          if (error) throw error;
          return [key, count ?? 0] as const;
        }),
      );
      const out: ServiceCounts = {};
      for (const [key, n] of results) if (n > 0) out[key] = n;
      return out;
    },
  });
}
