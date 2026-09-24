// El resumen de un viaje: todos sus servicios en una lista, para la vista
// previa que se abre desde la carpeta de viajes realizados.
//
// Reusa el mapeo de `liquidacion.ts` --las mismas diez tablas, los mismos
// nombres-- y le suma las reuniones, que no tienen costo y por eso no están en
// los reportes financieros pero sí son parte del viaje.
//
// A diferencia de la liquidación, aquí sí va el detalle: ciudad, fechas,
// tramo. Esta pantalla es para recordar qué se hizo, no para cuadrar dinero.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ServiceKey } from '../constants/serviceMeta';
import { netoServicio } from '../shared/cancelacion';
import { MAPEO, fch, soloFecha, txt } from './liquidacion';

export type ServicioResumen = {
  servicio: ServiceKey;
  nombre: string;
  sub: string;
  fecha: string | null;
  monto: number;
  moneda: string;
  estadoPago: string | null;
  cancelado: boolean;
};

export type ResumenViaje = {
  servicios: ServicioResumen[];
  total: number;
  /** Si hay servicios sin monto, el total es parcial y la pantalla lo dice. */
  sinMonto: number;
  monedas: string[];
};

export function useResumenViaje(viajeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['att_resumen_viaje', viajeId],
    enabled: !!viajeId && enabled,
    retry: false,
    queryFn: async (): Promise<ResumenViaje> => {
      const id = viajeId as string;
      const claves = Object.keys(MAPEO) as ServiceKey[];

      const [conCosto, reuniones] = await Promise.all([
        Promise.all(
          claves.map(async (clave) => {
            const m = MAPEO[clave];
            const cols = ['monto, moneda, estado_pago, reintegro, cancelado_en', m.extra, m.subExtra]
              .filter(Boolean)
              .join(', ');
            const { data, error } = await supabase
              .from(m.tabla as 'att_tickets')
              .select(cols)
              .eq('viaje_id', id)
              .is('deleted_at', null);
            if (error) throw error;
            return { clave, m, filas: (data ?? []) as unknown as Record<string, unknown>[] };
          }),
        ),
        supabase
          .from('att_reuniones')
          .select('titulo, tipo, lugar, ciudad, fecha, hora')
          .eq('viaje_id', id)
          .is('deleted_at', null),
      ]);

      if (reuniones.error) throw reuniones.error;

      const servicios: ServicioResumen[] = [];

      for (const { clave, m, filas } of conCosto) {
        for (const r of filas) {
          const cargo = Number(r.monto) || 0;
          servicios.push({
            servicio: clave,
            nombre: m.nombre(r) || '—',
            sub: m.sub?.(r) ?? '',
            fecha: soloFecha(m.fecha(r)),
            monto: netoServicio(cargo, Number(r.reintegro) || 0),
            moneda: txt(r.moneda) || 'USD',
            estadoPago: fch(r.estado_pago),
            cancelado: !!fch(r.cancelado_en),
          });
        }
      }

      for (const r of reuniones.data ?? []) {
        servicios.push({
          servicio: 'reunion',
          nombre: r.titulo || 'Reunión',
          sub: [r.tipo, r.lugar, r.ciudad, r.hora ? String(r.hora).slice(0, 5) : '']
            .filter((p) => !!p)
            .join(' · '),
          fecha: soloFecha(r.fecha),
          monto: 0,
          moneda: 'USD',
          estadoPago: null,
          cancelado: false,
        });
      }

      // En orden de calendario; lo que no tiene fecha, al final.
      servicios.sort((a, b) => {
        if (!a.fecha && !b.fecha) return 0;
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return a.fecha.localeCompare(b.fecha);
      });

      const conMonto = servicios.filter((s) => s.monto > 0);

      return {
        servicios,
        total: conMonto.reduce((s, x) => s + x.monto, 0),
        // Las reuniones no cuentan como "sin monto": no tienen costo por
        // naturaleza, no es que se haya olvidado capturarlo.
        sinMonto: servicios.filter((s) => s.monto === 0 && s.servicio !== 'reunion').length,
        monedas: [...new Set(conMonto.map((s) => s.moneda))],
      };
    },
  });
}
