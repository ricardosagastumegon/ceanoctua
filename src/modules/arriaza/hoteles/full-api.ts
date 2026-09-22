// Fase 22 · el hotel completo, con habitaciones y servicios extras.
//
// Mismo patrón que el ticket aéreo: `load` trae el árbol y `save` lo reconcilia
// contra la base, para que todo se capture en una sola pasada.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttHotel = Database['public']['Tables']['att_hoteles']['Row'];
export type AttHotelInsert = Database['public']['Tables']['att_hoteles']['Insert'];

export type HabitacionInput = {
  id?: string;
  reserva_nombre: string;
  pax: string;
  tipo_hab: string;
  desayuno: string;
  tarifa: string;
  noches: string;
};

export type ExtraInput = {
  id?: string;
  nombre: string;
  monto: string;
};

export type HotelCompleto = {
  hotel: AttHotel | null;
  habitaciones: HabitacionInput[];
  extras: ExtraInput[];
};

const ORDEN = { ascending: true, nullsFirst: true } as const;

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Total por habitación: tarifa por noche × número de noches. */
export function totalHabitacion(h: HabitacionInput): number {
  return num(h.tarifa) * num(h.noches);
}

/** Total de estadía: las habitaciones más los servicios extras. */
export function totalEstadia(habitaciones: HabitacionInput[], extras: ExtraInput[]): number {
  return (
    habitaciones.reduce((s, h) => s + totalHabitacion(h), 0) +
    extras.reduce((s, e) => s + num(e.monto), 0)
  );
}

/** Noches entre dos fechas. Devuelve 0 si falta alguna o si están al revés. */
export function nochesEntre(checkin: string, checkout: string): number {
  if (!checkin || !checkout) return 0;
  const ms = new Date(checkout).getTime() - new Date(checkin).getTime();
  const dias = Math.round(ms / 86_400_000);
  return dias > 0 ? dias : 0;
}

export async function subirConfirmacionHotel(hotelId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `hoteles/${hotelId}/confirmacion.${Date.now()}.${ext}`;
  const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from('att_hoteles')
    .update({ confirmacion_path: path })
    .eq('id', hotelId);
  if (error) throw error;
  return path;
}

export const hotelFullApi = {
  async load(hotelId: string): Promise<HotelCompleto> {
    const [hotelQ, habQ, extrasQ] = await Promise.all([
      supabase.from('att_hoteles').select('*').eq('id', hotelId).is('deleted_at', null).maybeSingle(),
      supabase.from('att_hotel_habitaciones').select('*').eq('hotel_id', hotelId).is('deleted_at', null).order('orden', ORDEN),
      supabase.from('att_hotel_services').select('*').eq('hotel_id', hotelId).is('deleted_at', null).order('orden', ORDEN),
    ]);
    if (hotelQ.error) throw hotelQ.error;
    if (habQ.error) throw habQ.error;
    if (extrasQ.error) throw extrasQ.error;

    return {
      hotel: hotelQ.data,
      habitaciones: (habQ.data ?? []).map((h) => ({
        id: h.id,
        reserva_nombre: h.reserva_nombre ?? '',
        pax: h.pax != null ? String(h.pax) : '',
        tipo_hab: h.tipo_hab ?? '',
        desayuno: h.desayuno ?? '',
        tarifa: h.tarifa != null ? String(h.tarifa) : '',
        noches: h.noches != null ? String(h.noches) : '',
      })),
      extras: (extrasQ.data ?? []).map((e) => ({
        id: e.id,
        nombre: e.nombre ?? '',
        monto: e.monto != null ? String(e.monto) : '',
      })),
    };
  },

  async save(input: {
    hotelId?: string;
    cabecera: AttHotelInsert;
    habitaciones: HabitacionInput[];
    extras: ExtraInput[];
  }): Promise<string> {
    const cabecera = {
      ...input.cabecera,
      monto: totalEstadia(input.habitaciones, input.extras),
      services_total: input.extras.reduce((s, e) => s + num(e.monto), 0),
    };

    let hotelId = input.hotelId;
    if (hotelId) {
      const patch = { ...cabecera } as Record<string, unknown>;
      for (const k of ['id', 'viaje_id', 'legacy_id', 'created_at', 'created_by']) delete patch[k];
      const { error } = await supabase
        .from('att_hoteles')
        .update(patch as Database['public']['Tables']['att_hoteles']['Update'])
        .eq('id', hotelId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('att_hoteles').insert(cabecera).select('id').single();
      if (error) throw error;
      hotelId = data.id;
    }

    await sincronizar('att_hotel_habitaciones', 'hotel_id', hotelId, input.habitaciones, (h, orden) => ({
      reserva_nombre: h.reserva_nombre.trim() || null,
      pax: h.pax.trim() === '' ? null : Number(h.pax),
      tipo_hab: h.tipo_hab.trim() || null,
      desayuno: h.desayuno.trim() || null,
      tarifa: h.tarifa.trim() === '' ? null : Number(h.tarifa),
      noches: h.noches.trim() === '' ? null : Number(h.noches),
      orden,
    }));

    await sincronizar('att_hotel_services', 'hotel_id', hotelId, input.extras, (e, orden) => ({
      nombre: e.nombre.trim() || null,
      monto: e.monto.trim() === '' ? null : Number(e.monto),
      orden,
    }));

    return hotelId;
  },
};

async function sincronizar<T extends { id?: string }>(
  tabla: 'att_hotel_habitaciones' | 'att_hotel_services',
  columna: string,
  padreId: string,
  items: T[],
  campos: (item: T, orden: number) => Record<string, unknown>,
) {
  const vivos = items.map((i) => i.id).filter(Boolean) as string[];
  const q = supabase
    .from(tabla)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq(columna, padreId)
    .is('deleted_at', null);
  const { error: delErr } = vivos.length ? await q.not('id', 'in', `(${vivos.join(',')})`) : await q;
  if (delErr) throw delErr;

  for (let i = 0; i < items.length; i++) {
    const valores = campos(items[i], i);
    if (items[i].id) {
      const { error } = await supabase.from(tabla).update(valores as never).eq('id', items[i].id as string);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(tabla).insert({ [columna]: padreId, ...valores } as never);
      if (error) throw error;
    }
  }
}
