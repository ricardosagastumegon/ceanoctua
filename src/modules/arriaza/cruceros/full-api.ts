// Crucero: encabezado, camarotes, y los abonos y extras de cada camarote.
//
// La estructura es de tres niveles y por eso no usa el CRUD genérico:
//
//   crucero  →  camarotes  →  abonos y servicios extra
//
// Dos cosas que conviene tener presentes al leer esto:
//
//  - El total del camarote es **tarifa × pax**, no × noches. La tarifa del
//    crucero se cotiza por persona y por el viaje completo; las noches son
//    informativas. Lo calcula la base como columna generada.
//  - La reserva se paga en abonos, cada uno con su tarjeta. El total del
//    crucero NO sube con los abonos —son forma de pago, no costo— pero sí
//    con los servicios extra.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttCrucero = Database['public']['Tables']['att_cruceros']['Row'];
export type AttCruceroInsert = Database['public']['Tables']['att_cruceros']['Insert'];
export type Camarote = Database['public']['Tables']['att_crucero_camarotes']['Row'];
export type PagoCamarote = Database['public']['Tables']['att_crucero_pagos']['Row'];
export type PaxCamarote = Database['public']['Tables']['att_crucero_pax']['Row'];

/** Un abono o un servicio extra, como se captura en pantalla. */
export type MovimientoInput = {
  id?: string;
  clase: 'pago' | 'extra';
  descripcion: string;
  monto: string;
  pagado_con_id: string;
  /** El texto de la tarjeta tal como se guardó ese día. Solo se lee. */
  pagado_con?: string | null;
  fecha_pago: string;
  comentario: string;
};

/** Un camarote con sus pasajeros y sus movimientos, como se captura en pantalla. */
export type CamaroteInput = {
  id?: string;
  reserva_nombre: string;
  /** El número que da la naviera para ESTE camarote. */
  reserva_numero: string;
  /**
   * Quiénes viajan en el camarote. Van como lista de nombres en pantalla pero
   * como una fila por persona en la base: es lo que permite filtrarlos y
   * exportarlos después.
   */
  pasajeros: string[];
  cubierta: string;
  camarote: string;
  pax: string;
  tipo_hab: string;
  alimentacion: string;
  tarifa: string;
  noches: string;
  notas: string;
  movimientos: MovimientoInput[];
};

export type CruceroCompleto = {
  crucero: AttCrucero | null;
  camarotes: CamaroteInput[];
};

const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Total del camarote: tarifa por pasajero × cantidad de pasajeros.
 *
 * Las noches NO entran. La tarifa del crucero es por persona y por el viaje
 * completo — confirmado con el usuario el 2026-09-28. Ojo que esto difiere
 * del hotel, donde `tarifa × noches` sí es correcto porque ahí la tarifa es
 * por noche.
 */
export function totalCamarote(c: { tarifa: string; pax: string }): number {
  return num(c.tarifa) * num(c.pax);
}

export function sumaMovimientos(m: MovimientoInput[], clase: 'pago' | 'extra'): number {
  return m.filter((x) => x.clase === clase).reduce((s, x) => s + num(x.monto), 0);
}

/**
 * Lo que falta para tener la reserva del camarote pagada al 100 %.
 *
 * Solo cuenta la reserva, no los extras: el documento dice «hasta pagar el
 * 100 % de **la reserva**», y además un servicio extra ya trae su propia
 * tarjeta y su propia fecha, o sea que ya está pagado. Meterlo en el
 * pendiente lo cobraría dos veces.
 */
export function pendienteCamarote(c: CamaroteInput): number {
  return totalCamarote(c) - sumaMovimientos(c.movimientos, 'pago');
}

/** Total de estadía: los camarotes con sus extras. Los abonos no suman. */
export function totalEstadia(camarotes: CamaroteInput[]): number {
  return camarotes.reduce(
    (s, c) => s + totalCamarote(c) + sumaMovimientos(c.movimientos, 'extra'),
    0,
  );
}

/**
 * El estado de pago del crucero, deducido de los abonos.
 *
 * En los otros servicios el estado se elige a mano, pero acá sería una forma
 * de mentirle a la hoja: los abonos ya dicen cuánto se lleva pagado, y un
 * "Pagado" escrito encima de una reserva a medio abonar no lo cambia. Se
 * calcula, y el único que lo pisa es la cancelación.
 */
export function estadoDeReserva(camarotes: CamaroteInput[]): string {
  const reserva = camarotes.reduce((s, c) => s + totalCamarote(c), 0);
  const abonado = camarotes.reduce((s, c) => s + sumaMovimientos(c.movimientos, 'pago'), 0);
  if (reserva > 0 && abonado >= reserva - 0.005) return 'Pagado';
  return abonado > 0.005 ? 'Pago parcial' : 'Reservado';
}

/** El orden no viaja en el objeto: lo pone el guardado según la posición. */
export function camaroteVacio(): CamaroteInput {
  return {
    reserva_nombre: '', reserva_numero: '', pasajeros: [], cubierta: '', camarote: '',
    pax: '2', tipo_hab: '', alimentacion: '', tarifa: '', noches: '', notas: '',
    movimientos: [],
  };
}

export const cruceroFullApi = {
  async load(id: string): Promise<CruceroCompleto> {
    const [cru, cam] = await Promise.all([
      supabase.from('att_cruceros').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('att_crucero_camarotes')
        .select('*')
        .eq('crucero_id', id)
        .is('deleted_at', null)
        .order('orden'),
    ]);
    if (cru.error) throw cru.error;
    if (cam.error) throw cam.error;

    const camarotes = (cam.data ?? []) as Camarote[];
    let pagos: PagoCamarote[] = [];
    let pax: PaxCamarote[] = [];
    if (camarotes.length) {
      const ids = camarotes.map((c) => c.id);
      const [resPagos, resPax] = await Promise.all([
        supabase.from('att_crucero_pagos').select('*')
          .in('camarote_id', ids).is('deleted_at', null).order('orden'),
        supabase.from('att_crucero_pax').select('*')
          .in('camarote_id', ids).is('deleted_at', null).order('orden'),
      ]);
      if (resPagos.error) throw resPagos.error;
      if (resPax.error) throw resPax.error;
      pagos = resPagos.data ?? [];
      pax = resPax.data ?? [];
    }

    return {
      crucero: cru.data ?? null,
      camarotes: camarotes.map((c) => ({
        id: c.id,
        reserva_nombre: c.reserva_nombre ?? '',
        reserva_numero: c.reserva_numero ?? '',
        pasajeros: pax.filter((x) => x.camarote_id === c.id).map((x) => x.nombre ?? ''),
        cubierta: c.cubierta ?? '',
        camarote: c.camarote ?? '',
        pax: String(c.pax ?? ''),
        tipo_hab: c.tipo_hab ?? '',
        alimentacion: c.alimentacion ?? '',
        tarifa: c.tarifa != null ? String(c.tarifa) : '',
        noches: c.noches != null ? String(c.noches) : '',
        notas: c.notas ?? '',
        movimientos: pagos
          .filter((p) => p.camarote_id === c.id)
          .map((p) => ({
            id: p.id,
            clase: (p.clase as 'pago' | 'extra') ?? 'pago',
            descripcion: p.descripcion ?? '',
            monto: String(p.monto ?? ''),
            pagado_con_id: p.pagado_con_id ?? '',
            pagado_con: p.pagado_con,
            fecha_pago: p.fecha_pago ?? '',
            comentario: p.comentario ?? '',
          })),
      })),
    };
  },

  /**
   * Guarda el crucero entero. Devuelve el id, que hace falta cuando es nuevo.
   *
   * Los camarotes y sus movimientos se reescriben: los que siguen se
   * actualizan, los que se quitaron se borran en suave, los nuevos se
   * insertan. En suave y no físico porque son dinero con historial en
   * `audit_log`.
   */
  async save(vars: {
    id?: string;
    cabecera: AttCruceroInsert;
    camarotes: CamaroteInput[];
    tarjetas: { id: string; etiqueta: string }[];
  }): Promise<string> {
    const { id, cabecera, camarotes, tarjetas } = vars;

    let cruceroId = id;
    if (cruceroId) {
      // Al actualizar no se reenvian ni el id ni el viaje: son la identidad
      // de la fila, no datos que se editen.
      const { viaje_id: _viaje, id: _id, ...patch } = cabecera;
      const { error } = await supabase.from('att_cruceros').update(patch).eq('id', cruceroId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('att_cruceros').insert(cabecera).select('id').single();
      if (error) throw error;
      cruceroId = data.id;
    }

    const previos = await supabase
      .from('att_crucero_camarotes')
      .select('id')
      .eq('crucero_id', cruceroId)
      .is('deleted_at', null);
    if (previos.error) throw previos.error;

    const vivos = new Set<string>();
    for (const [i, c] of camarotes.entries()) {
      const campos = {
        reserva_nombre: c.reserva_nombre.trim() || null,
        reserva_numero: c.reserva_numero.trim() || null,
        cubierta: c.cubierta.trim() || null,
        camarote: c.camarote.trim() || null,
        pax: Math.max(0, Math.round(num(c.pax))),
        tipo_hab: c.tipo_hab.trim() || null,
        alimentacion: c.alimentacion.trim() || null,
        tarifa: num(c.tarifa),
        noches: c.noches.trim() === '' ? null : Math.round(num(c.noches)),
        notas: c.notas.trim() || null,
        orden: i,
      };

      let camaroteId = c.id;
      if (camaroteId) {
        vivos.add(camaroteId);
        const { error } = await supabase
          .from('att_crucero_camarotes').update(campos).eq('id', camaroteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('att_crucero_camarotes')
          .insert({ crucero_id: cruceroId, ...campos })
          .select('id')
          .single();
        if (error) throw error;
        camaroteId = data.id;
      }

      await Promise.all([
        guardarMovimientos(camaroteId, c.movimientos, tarjetas),
        guardarPasajeros(camaroteId, c.pasajeros),
      ]);
    }

    const quitados = (previos.data ?? []).map((p) => p.id).filter((x) => !vivos.has(x));
    if (quitados.length) {
      const { error } = await supabase
        .from('att_crucero_camarotes')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', quitados);
      if (error) throw error;
    }

    return cruceroId as string;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('att_cruceros')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

/**
 * Los pasajeros del camarote.
 *
 * Acá sí se rehacen en vez de reconciliar: un pasajero es un nombre, no
 * dinero, y no tiene nada que conservar entre una edición y otra. Igual el
 * borrado es en suave, porque `audit_log` guarda quién iba en el camarote
 * antes de que alguien lo cambiara.
 */
async function guardarPasajeros(camaroteId: string, nombres: string[]): Promise<void> {
  const limpios = nombres.map((n) => n.trim()).filter(Boolean);

  const previos = await supabase
    .from('att_crucero_pax')
    .select('id')
    .eq('camarote_id', camaroteId)
    .is('deleted_at', null);
  if (previos.error) throw previos.error;

  if (previos.data?.length) {
    const { error } = await supabase
      .from('att_crucero_pax')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', previos.data.map((p) => p.id));
    if (error) throw error;
  }

  if (limpios.length) {
    const { error } = await supabase
      .from('att_crucero_pax')
      .insert(limpios.map((nombre, orden) => ({ camarote_id: camaroteId, nombre, orden })));
    if (error) throw error;
  }
}

async function guardarMovimientos(
  camaroteId: string,
  movimientos: MovimientoInput[],
  tarjetas: { id: string; etiqueta: string }[],
): Promise<void> {
  const previos = await supabase
    .from('att_crucero_pagos')
    .select('id')
    .eq('camarote_id', camaroteId)
    .is('deleted_at', null);
  if (previos.error) throw previos.error;

  const vivos = new Set<string>();
  for (const [i, m] of movimientos.entries()) {
    if (num(m.monto) <= 0) continue;
    const tarjeta = tarjetas.find((t) => t.id === m.pagado_con_id);
    const campos = {
      clase: m.clase,
      descripcion: m.descripcion.trim() || null,
      monto: num(m.monto),
      pagado_con_id: m.pagado_con_id || null,
      // El texto del día que se capturó: renombrar la tarjeta en Admin no
      // puede reescribir un reporte de hace meses.
      pagado_con: tarjeta?.etiqueta ?? null,
      fecha_pago: m.fecha_pago || null,
      comentario: m.comentario.trim() || null,
      orden: i,
    };

    if (m.id) {
      vivos.add(m.id);
      const { error } = await supabase.from('att_crucero_pagos').update(campos).eq('id', m.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('att_crucero_pagos').insert({ camarote_id: camaroteId, ...campos });
      if (error) throw error;
    }
  }

  const quitados = (previos.data ?? []).map((p) => p.id).filter((x) => !vivos.has(x));
  if (quitados.length) {
    const { error } = await supabase
      .from('att_crucero_pagos')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', quitados);
    if (error) throw error;
  }
}

export const cruceroKeys = {
  byViaje: (viajeId: string) => ['att_cruceros', viajeId] as const,
  full: (id: string | undefined) => ['att_crucero_full', id] as const,
};

export async function listarCruceros(viajeId: string): Promise<AttCrucero[]> {
  const { data, error } = await supabase
    .from('att_cruceros')
    .select('*')
    .eq('viaje_id', viajeId)
    .is('deleted_at', null)
    .order('salida_fecha', { nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}
