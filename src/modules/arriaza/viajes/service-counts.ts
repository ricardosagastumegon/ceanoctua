// Cuántos registros y cuánto dinero tiene cada servicio de un viaje.
//
// "Cuánto dinero" es el NETO: lo que se pagó menos lo que se reintegró al
// cancelar. Un servicio cancelado con devolución total costó cero y por eso no
// mueve el total, pero sigue contando como registro y sigue apareciendo.
//
// Para qué: la pantalla del viaje solo muestra los servicios que ya tienen algo
// guardado — apilar los once satura —, y el encabezado necesita el costo total,
// que es la suma de lo que cuesta cada servicio.
//
// Se pide `head: true` para los conteos, así que la base devuelve solo el
// número. Los montos sí traen filas, pero únicamente la columna `monto`.

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
  crucero: 'att_cruceros',
  tiendas: 'att_tiendas',
  ruta: 'att_rutas',
  poi: 'att_pois',
} as const satisfies Record<ServiceKey, string>;

/**
 * Servicios que ya guardan su total en `monto`. Los demás todavía no tienen la
 * columna — se les agrega cuando les toque su documento — y mientras tanto
 * aportan cero al total del viaje.
 *
 * Falta reunion, que en el HTML viejo no manejaba costo.
 */
const CON_MONTO = [
  'tickets', 'hotel', 'restaurantes', 'renta',
  'tours', 'aeronave', 'acuatico', 'ferry',
  'terrestre', 'actividades', 'crucero',
] as const;

export type ServiceSummary = {
  /** Cuántos registros tiene cada servicio. Solo los que tienen alguno. */
  counts: Partial<Record<ServiceKey, number>>;
  /** Cuánto suma cada servicio. */
  montos: Partial<Record<ServiceKey, number>>;
  /** Suma de todos los servicios que ya guardan su total. */
  total: number;
  /**
   * Monedas distintas encontradas. Si hay más de una, sumar es mentir: el
   * total se muestra como referencia y la pantalla lo advierte.
   */
  monedas: string[];
  /** Si hay servicios con registros cuyo monto todavía no se puede sumar. */
  totalParcial: boolean;
  /**
   * Los cargos adicionales del viaje. Desde que cada uno lleva su propia
   * tarjeta y su propia fecha viven aparte del servicio, así que hay que
   * sumarlos explícitamente: el `monto` del servicio ya no los incluye.
   */
  cargos: number;
};

export function useServiceSummary(viajeId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['att_service_counts', viajeId],
    enabled: !!viajeId && enabled,
    queryFn: async (): Promise<ServiceSummary> => {
      const entries = Object.entries(TABLA_POR_SERVICIO) as [ServiceKey, string][];
      const conMonto = new Set<string>(CON_MONTO);

      // Los cargos adicionales van en su propia consulta. Antes vivían dentro
      // del `monto` del servicio; al separarlos para que cada uno pudiera
      // llevar su tarjeta y su fecha, el total del viaje habría quedado corto
      // si no se suman aquí.
      const monedasCargos = new Set<string>();
      const cargosQ = await supabase
        .from('att_cargos')
        .select('monto, reintegro, moneda, servicio_tipo')
        .eq('viaje_id', viajeId as string)
        .is('deleted_at', null);
      if (cargosQ.error) throw cargosQ.error;

      const resultados = await Promise.all(
        entries.map(async ([key, tabla]) => {
          if (conMonto.has(key)) {
            const { data, error } = await supabase
              .from(tabla as 'att_tickets')
              .select('monto, moneda, reintegro')
              .eq('viaje_id', viajeId as string)
              .is('deleted_at', null);
            if (error) throw error;
            const filas = data ?? [];
            return {
              key,
              count: filas.length,
              // El neto, no el cargo: un servicio cancelado con reintegro
              // parcial costo la diferencia, y con reintegro total costo cero.
              monto: filas.reduce(
                (s, f) => s + ((Number(f.monto) || 0) - (Number(f.reintegro) || 0)),
                0,
              ),
              monedas: filas.map((f) => f.moneda).filter(Boolean) as string[],
              sumable: true,
            };
          }
          const { count, error } = await supabase
            .from(tabla)
            .select('id', { count: 'exact', head: true })
            .eq('viaje_id', viajeId as string)
            .is('deleted_at', null);
          if (error) throw error;
          return { key, count: count ?? 0, monto: 0, monedas: [] as string[], sumable: false };
        }),
      );

      const counts: Partial<Record<ServiceKey, number>> = {};
      const montos: Partial<Record<ServiceKey, number>> = {};
      // El neto del cargo, igual que en los servicios: lo que de verdad costó.
      const porServicio = new Map<string, number>();
      let cargos = 0;
      for (const c of cargosQ.data ?? []) {
        const neto = (Number(c.monto) || 0) - (Number(c.reintegro) || 0);
        cargos += neto;
        porServicio.set(c.servicio_tipo, (porServicio.get(c.servicio_tipo) ?? 0) + neto);
        if (c.moneda) monedasCargos.add(c.moneda);
      }
      let total = cargos;
      let totalParcial = false;
      const monedas = new Set<string>(monedasCargos);
      for (const r of resultados) {
        if (r.count === 0) continue;
        counts[r.key] = r.count;
        if (r.sumable) {
          // El servicio muestra su base más lo que se le cargó aparte.
          montos[r.key] = r.monto + (porServicio.get(r.key) ?? 0);
          total += r.monto;
          for (const m of r.monedas) monedas.add(m);
        } else {
          totalParcial = true;
        }
      }
      return { counts, montos, total, monedas: [...monedas], totalParcial, cargos };
    },
  });
}
