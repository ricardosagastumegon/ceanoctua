// La liquidación por período: todos los viajes, agrupados por tarjeta.
//
// Es la liquidación al revés. La del viaje responde "cuánto costó este viaje";
// esta responde "cuánto hay que pagarle a esta tarjeta este mes", que es como
// vienen los estados de cuenta y como se pagan de verdad.
//
// Lee exactamente las mismas diez tablas que `liquidacion.ts` y reusa su
// mapeo, a propósito: si mañana se agrega un servicio, aparece en los dos
// reportes o en ninguno.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ServiceKey } from '../constants/serviceMeta';
import { netoServicio } from '../shared/cancelacion';
import { COMUNES, MAPEO, fch, soloFecha, txt } from './liquidacion';

export type RenglonPeriodo = {
  servicio: ServiceKey;
  nombre: string;
  /** Cuándo ocurre el servicio. */
  fecha: string | null;
  /** Cuándo se cobró la tarjeta, si se capturó. */
  fechaCargo: string | null;
  /**
   * La que manda para ubicar el renglón en un período: un hotel de diciembre
   * pagado en octubre aparece en el estado de cuenta de octubre.
   */
  fechaEfectiva: string | null;
  viajeId: string;
  viajeTitulo: string;
  viajeNo: string | null;
  cargo: number;
  reintegro: number;
  neto: number;
  moneda: string;
  estadoPago: string | null;
  canceladoEn: string | null;
  pagadoCon: string | null;
  /** El identificador de la tarjeta tal como estaba el día que se capturó. */
  pagadoConCorto: string | null;
  pagadoConId: string | null;
};

export type TarjetaPeriodo = {
  tarjetaId: string | null;
  etiqueta: string;
  identificada: boolean;
  cargos: number;
  reintegros: number;
  neto: number;
  renglones: RenglonPeriodo[];
  /** Los viajes que tocó esta tarjeta en el período, para el resumen. */
  viajes: string[];
};

export type LiquidacionPeriodo = {
  desde: string;
  hasta: string;
  tarjetas: TarjetaPeriodo[];
  renglones: RenglonPeriodo[];
  /**
   * Servicios con dinero que no tienen ni fecha de cargo ni fecha propia. No
   * caben en ningún período, así que si se filtraran sin más desaparecerían de
   * todos los reportes. Se muestran aparte para que nadie pague de menos.
   */
  sinFecha: RenglonPeriodo[];
  cargos: number;
  reintegros: number;
  neto: number;
  monedas: string[];
};

/** El mes en curso, que es el período por defecto. */
export function mesActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  return {
    desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
  };
}

export function mesPasado(): { desde: string; hasta: string } {
  const hoy = new Date();
  return {
    desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
    hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
  };
}

export function anioActual(): { desde: string; hasta: string } {
  const a = new Date().getFullYear();
  return { desde: `${a}-01-01`, hasta: `${a}-12-31` };
}

/** Local, no UTC: `toISOString()` sobre un Date local corre el día. */
function iso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

export function useLiquidacionPeriodo(desde: string, hasta: string, enabled = true) {
  return useQuery({
    queryKey: ['att_liquidacion_periodo', desde, hasta],
    enabled: enabled && !!desde && !!hasta,
    retry: false,
    queryFn: async (): Promise<LiquidacionPeriodo> => {
      const claves = Object.keys(MAPEO) as ServiceKey[];

      // Se traen las diez tablas enteras y se filtra abajo, en JavaScript.
      // La condición real es sobre `coalesce(fecha_cargo, fecha_propia)`, que
      // en PostgREST obliga a un `or(and(...),and(...))` distinto por tabla:
      // diez cadenas escritas a mano, cada una una forma de equivocarse en
      // silencio en un reporte de dinero. Con el volumen de esta operación no
      // vale la pena. Si crece, esto se vuelve una función en la base.
      const [resultados, viajes, tarjetas] = await Promise.all([
        Promise.all(
          claves.map(async (clave) => {
            const m = MAPEO[clave];
            const { data, error } = await supabase
              .from(m.tabla as 'att_tickets')
              .select(`viaje_id, ${COMUNES}, ${m.extra}`)
              .is('deleted_at', null);
            if (error) throw error;
            return { clave, m, filas: (data ?? []) as unknown as Record<string, unknown>[] };
          }),
        ),
        supabase.from('att_viajes').select('id, titulo, trip_no').is('deleted_at', null),
        supabase.from('tarjetas_credito').select('id, tc_id, red, banco, titular'),
      ]);

      if (viajes.error) throw viajes.error;
      if (tarjetas.error) throw tarjetas.error;

      const porViaje = new Map((viajes.data ?? []).map((v) => [v.id, v]));
      const nombreTarjeta = new Map(
        (tarjetas.data ?? []).map((t) => [
          t.id,
          [t.tc_id, t.red, t.banco, t.titular].filter(Boolean).join(' · '),
        ]),
      );
      const cortoTarjeta = new Map((tarjetas.data ?? []).map((t) => [t.id, t.tc_id ?? '']));

      /** El identificador corto tal como se guardó ese día, no el de hoy. */
      const cortoHistorico = (texto: string | null, id: string | null): string | null => {
        const primero = texto?.split(' · ')[0]?.trim();
        if (primero) return primero;
        return id ? cortoTarjeta.get(id) || null : null;
      };

      const todos: RenglonPeriodo[] = [];
      for (const { clave, m, filas } of resultados) {
        for (const r of filas) {
          const cargo = Number(r.monto) || 0;
          const reintegro = Number(r.reintegro) || 0;

          // Sin dinero no hay nada que liquidar. A diferencia de la
          // liquidación del viaje, que lista el viaje entero, este reporte es
          // de consumo: un servicio en cero es ruido entre lo que hay que
          // pagar.
          if (cargo === 0 && reintegro === 0) continue;

          const viajeId = fch(r.viaje_id) ?? '';
          const v = porViaje.get(viajeId);
          // Recortadas a YYYY-MM-DD antes de compararlas contra el rango:
          // `fecha_salida` de los tickets es timestamptz y sin esto el último
          // día del período se perdería en silencio.
          const fecha = soloFecha(m.fecha(r));
          const fechaCargo = soloFecha(r.fecha_cargo);

          todos.push({
            servicio: clave,
            nombre: m.nombre(r) || '—',
            fecha,
            fechaCargo,
            fechaEfectiva: fechaCargo ?? fecha,
            viajeId,
            viajeTitulo: v?.titulo ?? 'Viaje borrado',
            viajeNo: v?.trip_no ?? null,
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

      const dentro = todos.filter(
        (r) => r.fechaEfectiva && r.fechaEfectiva >= desde && r.fechaEfectiva <= hasta,
      );
      const sinFecha = todos.filter((r) => !r.fechaEfectiva);

      dentro.sort((a, b) => (a.fechaEfectiva ?? '').localeCompare(b.fechaEfectiva ?? ''));

      // Agrupado por tarjeta, que es a lo que viene la hoja. Lo que no se pudo
      // identificar se junta aparte en vez de repartirse mal.
      const mapa = new Map<string, TarjetaPeriodo>();
      for (const r of dentro) {
        const llave = r.pagadoConId ?? `texto:${r.pagadoCon ?? ''}`;
        const previo = mapa.get(llave) ?? {
          tarjetaId: r.pagadoConId,
          etiqueta:
            r.pagadoCon ??
            (r.pagadoConId
              ? nombreTarjeta.get(r.pagadoConId) ?? 'Tarjeta desconocida'
              : 'Sin forma de pago'),
          identificada: !!r.pagadoConId,
          cargos: 0,
          reintegros: 0,
          neto: 0,
          renglones: [],
          viajes: [],
        };
        previo.cargos += r.cargo;
        previo.reintegros += r.reintegro;
        previo.neto += r.neto;
        previo.renglones.push(r);
        if (!previo.viajes.includes(r.viajeTitulo)) previo.viajes.push(r.viajeTitulo);
        mapa.set(llave, previo);
      }

      const lista = [...mapa.values()].sort(
        (a, b) => Number(b.identificada) - Number(a.identificada) || b.neto - a.neto,
      );

      return {
        desde,
        hasta,
        tarjetas: lista,
        renglones: dentro,
        sinFecha,
        cargos: dentro.reduce((s, r) => s + r.cargo, 0),
        reintegros: dentro.reduce((s, r) => s + r.reintegro, 0),
        neto: dentro.reduce((s, r) => s + r.neto, 0),
        monedas: [...new Set(dentro.map((r) => r.moneda))],
      };
    },
  });
}
