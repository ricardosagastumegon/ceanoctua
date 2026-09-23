// Fase 22 · actividades y eventos.
//
// A diferencia de los otros servicios, la actividad tiene una tabla hija: sus
// participantes, cada uno con su tarifa y -- si el evento las maneja -- su
// número de ticket y su lugar. Por eso guardar reconcilia: inserta los nuevos,
// actualiza los que cambiaron y borra en suave los que se quitaron.
//
// La tarifa vive en el participante desde el 2026-09-23, a pedido del usuario:
// antes era una sola por evento y todos pagaban igual.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttActividad = Database['public']['Tables']['att_actividades']['Row'];
export type AttActividadInsert = Database['public']['Tables']['att_actividades']['Insert'];
export type AttEntrada = Database['public']['Tables']['att_actividad_entradas']['Row'];

/** Un participante del evento. Sin `id` todavía no existe en la base. */
export type EntradaInput = {
  id?: string;
  nombre: string;
  ticket: string;
  lugar: string;
  /** Lo que cuesta la entrada de esta persona. */
  tarifa: string;
};

const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Total del evento: la suma de lo que paga cada participante, más los extras.
 *
 * La tarifa vive en el participante y no en el evento porque las entradas de
 * una misma función pueden ser de categorías distintas -- un palco y una
 * platea no cuestan lo mismo.
 *
 * Si el evento todavía no tiene participantes detallados cae a la tarifa por
 * defecto × la cantidad de personas, para que una carga rápida sin desglosar
 * siga dando un número.
 */
export function totalActividad(
  entradas: readonly { tarifa: string | number | null | undefined }[],
  tarifaPorDefecto: string | number | null | undefined,
  personas: string | number | null | undefined,
  montoExtras: string | number | null | undefined,
): number {
  const extras = num(montoExtras);
  if (entradas.length > 0) {
    return entradas.reduce((s, e) => s + num(e.tarifa), 0) + extras;
  }
  return num(tarifaPorDefecto) * num(personas) + extras;
}

export async function subirConfirmacionActividad(id: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `actividades/${id}/confirmacion.${Date.now()}.${ext}`;
  const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from('att_actividades')
    .update({ confirmacion_path: path })
    .eq('id', id);
  if (error) throw error;
  return path;
}

export async function listarEntradas(actividadId: string): Promise<AttEntrada[]> {
  const { data, error } = await supabase
    .from('att_actividad_entradas')
    .select('*')
    .eq('actividad_id', actividadId)
    .is('deleted_at', null)
    .order('orden', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function sincronizarEntradas(actividadId: string, deseadas: EntradaInput[]): Promise<void> {
  const actuales = await listarEntradas(actividadId);
  const vivos = new Set(deseadas.map((d) => d.id).filter(Boolean) as string[]);

  const aBorrar = actuales.filter((a) => !vivos.has(a.id)).map((a) => a.id);
  if (aBorrar.length > 0) {
    const { error } = await supabase
      .from('att_actividad_entradas')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', aBorrar);
    if (error) throw error;
  }

  for (let i = 0; i < deseadas.length; i++) {
    const e = deseadas[i];
    const valores = {
      nombre: e.nombre.trim() || null,
      ticket: e.ticket.trim() || null,
      lugar: e.lugar.trim() || null,
      tarifa: e.tarifa.trim() === '' ? null : Number(e.tarifa),
      orden: i,
    };
    if (e.id) {
      const { error } = await supabase
        .from('att_actividad_entradas').update(valores).eq('id', e.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('att_actividad_entradas').insert({ actividad_id: actividadId, ...valores });
      if (error) throw error;
    }
  }
}

export const actividadesFullApi = {
  async load(id: string): Promise<{ cabecera: AttActividad | null; entradas: AttEntrada[] }> {
    const { data, error } = await supabase
      .from('att_actividades').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    if (!data) return { cabecera: null, entradas: [] };
    return { cabecera: data, entradas: await listarEntradas(id) };
  },

  async save(input: {
    id?: string;
    cabecera: AttActividadInsert;
    entradas: EntradaInput[];
  }): Promise<string> {
    let id = input.id;
    if (id) {
      const patch = { ...input.cabecera } as Record<string, unknown>;
      for (const k of ['id', 'viaje_id', 'created_at', 'created_by']) delete patch[k];
      const { error } = await supabase
        .from('att_actividades')
        .update(patch as Database['public']['Tables']['att_actividades']['Update'])
        .eq('id', id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('att_actividades').insert(input.cabecera).select('id').single();
      if (error) throw error;
      id = data.id;
    }
    // Los participantes se guardan siempre: son los que definen el total. La
    // casilla `tiene_tickets` solo decide si además se piden número de ticket
    // y lugar, no si la lista existe.
    await sincronizarEntradas(id, input.entradas);
    return id;
  },
};
