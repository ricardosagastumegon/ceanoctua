// Cargos adicionales de un servicio.
//
// Un extra no es un número dentro del servicio: es un cobro con vida propia,
// con su descripción, su monto, su tarjeta y su fecha. Antes el extra se
// sumaba al `monto` del servicio y al liquidar se le cargaba entero a la
// tarjeta del servicio, aunque se hubiera pagado después y con otra —el
// consumo por tarjeta salía mal.
//
// Una sola tabla para los once servicios, en vez de repetir dos columnas en
// cada tabla y el mismo formulario en cada pantalla.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { ServiceKey } from '../constants/serviceMeta';

export type Cargo = Database['public']['Tables']['att_cargos']['Row'];
export type CargoInsert = Database['public']['Tables']['att_cargos']['Insert'];
export type CargoUpdate = Database['public']['Tables']['att_cargos']['Update'];

/** Lo que se captura en pantalla, antes de guardarse. */
export type CargoInput = {
  id?: string;
  descripcion: string;
  monto: string;
  pagado_con_id: string;
  fecha_cargo: string;
  pax_id?: string | null;
  notas?: string | null;
};

export const cargosApi = {
  async byServicio(tipo: ServiceKey, servicioId: string): Promise<Cargo[]> {
    const { data, error } = await supabase
      .from('att_cargos')
      .select('*')
      .eq('servicio_tipo', tipo)
      .eq('servicio_id', servicioId)
      .is('deleted_at', null)
      .order('orden')
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  },

  /** Todos los cargos del viaje, para la liquidación. Un solo viaje a la base. */
  async byViaje(viajeId: string): Promise<Cargo[]> {
    const { data, error } = await supabase
      .from('att_cargos')
      .select('*')
      .eq('viaje_id', viajeId)
      .is('deleted_at', null)
      .order('fecha_cargo');
    if (error) throw error;
    return data ?? [];
  },

  /** Todos los cargos, para la liquidación por período. */
  async todos(): Promise<Cargo[]> {
    const { data, error } = await supabase
      .from('att_cargos')
      .select('*')
      .is('deleted_at', null);
    if (error) throw error;
    return data ?? [];
  },
};

/**
 * Reescribe los cargos del servicio con lo que quedó en pantalla.
 *
 * Los que ya existían y siguen ahí se actualizan; los que se quitaron se
 * borran en suave; los nuevos se insertan. No se borra todo y se vuelve a
 * insertar como en otras listas del proyecto: un cargo es dinero con
 * historial en `audit_log`, y rehacerlo cada vez perdería el rastro de quién
 * lo cambió y cuándo.
 */
export async function guardarCargos(
  viajeId: string,
  tipo: ServiceKey,
  servicioId: string,
  moneda: string,
  entradas: CargoInput[],
  tarjetas: { id: string; etiqueta: string }[],
): Promise<void> {
  const previos = await cargosApi.byServicio(tipo, servicioId);
  const vivos = new Set<string>();

  for (const [i, e] of entradas.entries()) {
    const monto = Number(e.monto);
    if (!e.descripcion.trim() || !Number.isFinite(monto) || monto <= 0) continue;

    const tarjeta = tarjetas.find((t) => t.id === e.pagado_con_id);
    const campos = {
      descripcion: e.descripcion.trim(),
      monto,
      moneda,
      pagado_con_id: e.pagado_con_id || null,
      // El texto del día que se capturó: renombrar la tarjeta en Admin no
      // puede reescribir un reporte de hace meses.
      pagado_con: tarjeta?.etiqueta ?? null,
      fecha_cargo: e.fecha_cargo || null,
      pax_id: e.pax_id || null,
      notas: e.notas ?? null,
      orden: i,
    };

    if (e.id) {
      vivos.add(e.id);
      const { error } = await supabase.from('att_cargos').update(campos).eq('id', e.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('att_cargos').insert({
        viaje_id: viajeId,
        servicio_tipo: tipo,
        servicio_id: servicioId,
        ...campos,
      });
      if (error) throw error;
    }
  }

  const quitados = previos.filter((p) => !vivos.has(p.id)).map((p) => p.id);
  if (quitados.length) {
    const { error } = await supabase
      .from('att_cargos')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', quitados);
    if (error) throw error;
  }
}

export function cargoAInput(c: Cargo): CargoInput {
  return {
    id: c.id,
    descripcion: c.descripcion,
    monto: String(c.monto),
    pagado_con_id: c.pagado_con_id ?? '',
    fecha_cargo: c.fecha_cargo ?? '',
    pax_id: c.pax_id,
    notas: c.notas,
  };
}

export function sumaCargos(lista: { monto: string | number }[]): number {
  return lista.reduce((s, c) => {
    const n = Number(c.monto);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
}
