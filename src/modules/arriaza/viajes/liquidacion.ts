// La liquidación del viaje: un renglón por servicio y el consumo por tarjeta.
//
// No filtra por fechas. Lleva todos los servicios del viaje, se hayan comprado
// cuando se hayan comprado -- criterio del usuario, 2026-09-23.
//
// Cada servicio guarda su nombre y su fecha en columnas distintas, así que el
// mapeo vive aquí, en un solo lugar, en vez de repartido por diez archivos.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ServiceKey } from '../constants/serviceMeta';
import { netoServicio, type TablaServicio } from '../shared/cancelacion';

export type RenglonLiquidacion = {
  servicio: ServiceKey;
  nombre: string;
  /** 'YYYY-MM-DD' de cuándo ocurre el servicio. */
  fecha: string | null;
  /** Cuándo se cobró la tarjeta, si se capturó. */
  fechaCargo: string | null;
  cargo: number;
  reintegro: number;
  neto: number;
  moneda: string;
  estadoPago: string | null;
  canceladoEn: string | null;
  pagadoCon: string | null;
  /**
   * El identificador de la tarjeta tal como estaba el día que se capturó, no
   * el de hoy. Una liquidación impresa hace meses tiene que decir lo mismo si
   * se reimprime: si no, editar una tarjeta en Admin reescribiría en silencio
   * todos los reportes pasados.
   */
  pagadoConCorto: string | null;
  pagadoConId: string | null;
};

export type ConsumoTarjeta = {
  tarjetaId: string | null;
  /** El nombre de la tarjeta, o el texto suelto si no se pudo identificar. */
  etiqueta: string;
  identificada: boolean;
  cargos: number;
  reintegros: number;
  neto: number;
  servicios: number;
};

export type Liquidacion = {
  renglones: RenglonLiquidacion[];
  tarjetas: ConsumoTarjeta[];
  cargos: number;
  reintegros: number;
  neto: number;
  /** Si hay más de una, sumar es mentir y la hoja lo advierte. */
  monedas: string[];
};

/**
 * De dónde sale el nombre y la fecha de cada servicio.
 *
 * `extra` son las columnas propias que hay que pedir además de las comunes.
 *
 * Se exporta porque la liquidación por período lee exactamente las mismas diez
 * tablas. Tener el mapeo en dos lugares sería garantía de que algún día uno de
 * los dos reportes deje de ver un servicio.
 */
export type Mapeo = {
  tabla: TablaServicio;
  extra: string;
  nombre: (r: Record<string, unknown>) => string;
  fecha: (r: Record<string, unknown>) => string | null;
};

export const txt = (v: unknown): string => (typeof v === 'string' ? v : '');
export const fch = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/**
 * Recorta una fecha a `YYYY-MM-DD`.
 *
 * La mayoría de las columnas de fecha de los servicios son `date` y vuelven
 * ya así, pero `att_tickets.fecha_salida` es `timestamptz` y vuelve como
 * `2026-09-24 00:00:00+00`. Comparar eso contra un `YYYY-MM-DD` deja fuera el
 * último día del rango, porque `'2026-09-30 00:00:00+00' > '2026-09-30'`.
 *
 * Se recorta en vez de convertir a `Date`: estas fechas son días de
 * calendario guardados a medianoche UTC, y pasarlas por la zona horaria local
 * (Guatemala, UTC-6) las correría un día hacia atrás.
 */
export const soloFecha = (v: unknown): string | null => {
  const s = fch(v);
  return s ? s.slice(0, 10) : null;
};

export const MAPEO: Record<string, Mapeo> = {
  tickets: {
    tabla: 'att_tickets', extra: 'titulo, aerolinea, origen, destino, fecha_salida',
    nombre: (r) => txt(r.titulo) || `${txt(r.origen) || '?'} → ${txt(r.destino) || '?'}`,
    fecha: (r) => fch(r.fecha_salida),
  },
  hotel: {
    tabla: 'att_hoteles', extra: 'nombre, ciudad, checkin',
    nombre: (r) => txt(r.nombre), fecha: (r) => fch(r.checkin),
  },
  restaurantes: {
    tabla: 'att_restaurantes', extra: 'nombre, ciudad, fecha',
    nombre: (r) => txt(r.nombre), fecha: (r) => fch(r.fecha),
  },
  renta: {
    tabla: 'att_rentas', extra: 'nombre, recepcion_fecha',
    nombre: (r) => txt(r.nombre), fecha: (r) => fch(r.recepcion_fecha),
  },
  tours: {
    tabla: 'att_tours', extra: 'nombre, prestador, fecha',
    nombre: (r) => txt(r.nombre) || txt(r.prestador), fecha: (r) => fch(r.fecha),
  },
  aeronave: {
    tabla: 'att_aeronaves', extra: 'prestador, fecha',
    nombre: (r) => txt(r.prestador), fecha: (r) => fch(r.fecha),
  },
  acuatico: {
    tabla: 'att_acuaticos', extra: 'prestador, fecha',
    nombre: (r) => txt(r.prestador), fecha: (r) => fch(r.fecha),
  },
  ferry: {
    tabla: 'att_ferries', extra: 'prestador, fecha',
    nombre: (r) => txt(r.prestador), fecha: (r) => fch(r.fecha),
  },
  terrestre: {
    tabla: 'att_terrestres', extra: 'prestador, fecha',
    nombre: (r) => txt(r.prestador), fecha: (r) => fch(r.fecha),
  },
  actividades: {
    tabla: 'att_actividades', extra: 'evento, fecha',
    nombre: (r) => txt(r.evento), fecha: (r) => fch(r.fecha),
  },
};

export const COMUNES =
  'monto, reintegro, moneda, estado_pago, cancelado_en, pagado_con, pagado_con_id, fecha_cargo';

export function useLiquidacion(viajeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['att_liquidacion', viajeId],
    enabled: !!viajeId && enabled,
    retry: false,
    queryFn: async (): Promise<Liquidacion> => {
      const id = viajeId as string;
      const claves = Object.keys(MAPEO) as ServiceKey[];

      const resultados = await Promise.all(
        claves.map(async (clave) => {
          const m = MAPEO[clave];
          const { data, error } = await supabase
            .from(m.tabla as 'att_tickets')
            .select(`${COMUNES}, ${m.extra}`)
            .eq('viaje_id', id)
            .is('deleted_at', null);
          if (error) throw error;
          return { clave, m, filas: (data ?? []) as unknown as Record<string, unknown>[] };
        }),
      );

      // Las tarjetas, para poner nombre a cada `pagado_con_id`.
      const tarjetas = await supabase
        .from('tarjetas_credito').select('id, tc_id, red, banco, titular');
      if (tarjetas.error) throw tarjetas.error;
      const nombreTarjeta = new Map(
        (tarjetas.data ?? []).map((t) => [
          t.id,
          [t.tc_id, t.red, t.banco, t.titular].filter(Boolean).join(' · '),
        ]),
      );
      // El identificador solo, sin banco ni titular: es lo que cabe en la
      // columna de la tabla sin partirse en cinco lineas.
      const cortoTarjeta = new Map((tarjetas.data ?? []).map((t) => [t.id, t.tc_id ?? '']));

      /**
       * El nombre corto tal como se guardo ese dia. El texto capturado es
       * `tc_id · red · banco · titular`, asi que el primer tramo es el
       * identificador de entonces. Solo se cae al catalogo actual cuando no
       * hay texto guardado.
       */
      const cortoHistorico = (texto: string | null, id: string | null): string | null => {
        const primero = texto?.split(' · ')[0]?.trim();
        if (primero) return primero;
        return id ? cortoTarjeta.get(id) || null : null;
      };

      const renglones: RenglonLiquidacion[] = [];
      for (const { clave, m, filas } of resultados) {
        for (const r of filas) {
          const cargo = Number(r.monto) || 0;
          const reintegro = Number(r.reintegro) || 0;
          renglones.push({
            servicio: clave,
            nombre: m.nombre(r) || '—',
            fecha: soloFecha(m.fecha(r)),
            fechaCargo: soloFecha(r.fecha_cargo),
            cargo,
            reintegro,
            neto: netoServicio(cargo, reintegro),
            moneda: txt(r.moneda) || 'USD',
            estadoPago: fch(r.estado_pago),
            canceladoEn: fch(r.cancelado_en),
            pagadoCon: fch(r.pagado_con),
            pagadoConCorto: cortoHistorico(fch(r.pagado_con), fch(r.pagado_con_id)),
            pagadoConId: fch(r.pagado_con_id),
          });
        }
      }

      // Lo más temprano primero; lo que no tiene fecha, al final.
      renglones.sort((a, b) => {
        if (!a.fecha && !b.fecha) return 0;
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return a.fecha.localeCompare(b.fecha);
      });

      // El consumo por tarjeta, que es a lo que va esta hoja. Lo que no se
      // pudo identificar se agrupa aparte en vez de repartirse mal.
      const porTarjeta = new Map<string, ConsumoTarjeta>();
      for (const r of renglones) {
        const llave = r.pagadoConId ?? `texto:${r.pagadoCon ?? ''}`;
        const previo = porTarjeta.get(llave) ?? {
          tarjetaId: r.pagadoConId,
          // Se agrupa por la llave, pero se rotula con lo que se capturo: el
          // reporte tiene que decir lo mismo dentro de un ano.
          etiqueta: r.pagadoCon
            || (r.pagadoConId ? nombreTarjeta.get(r.pagadoConId) ?? 'Tarjeta desconocida' : 'Sin forma de pago'),
          identificada: !!r.pagadoConId,
          cargos: 0, reintegros: 0, neto: 0, servicios: 0,
        };
        previo.cargos += r.cargo;
        previo.reintegros += r.reintegro;
        previo.neto += r.neto;
        previo.servicios += 1;
        porTarjeta.set(llave, previo);
      }

      const lista = [...porTarjeta.values()].sort(
        (a, b) => Number(b.identificada) - Number(a.identificada) || b.neto - a.neto,
      );

      return {
        renglones,
        tarjetas: lista,
        cargos: renglones.reduce((s, r) => s + r.cargo, 0),
        reintegros: renglones.reduce((s, r) => s + r.reintegro, 0),
        neto: renglones.reduce((s, r) => s + r.neto, 0),
        monedas: [...new Set(renglones.map((r) => r.moneda))],
      };
    },
  });
}
