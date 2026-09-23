// Fase 22 · actividades y eventos.
//
// A diferencia de los otros servicios de este documento, la actividad sí tiene
// una tabla hija: las entradas -- nombre, número de ticket y lugar -- que el
// documento pide cuando se marca la casilla "No. de Ticket ... si es que
// aplica". Por eso guardar reconcilia: inserta las nuevas, actualiza las que
// cambiaron y borra en suave las que el usuario quitó de la lista.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttActividad = Database['public']['Tables']['att_actividades']['Row'];
export type AttActividadInsert = Database['public']['Tables']['att_actividades']['Insert'];
export type AttEntrada = Database['public']['Tables']['att_actividad_entradas']['Row'];

/** Una entrada en el formulario. Sin `id` todavía no existe en la base. */
export type EntradaInput = {
  id?: string;
  nombre: string;
  ticket: string;
  lugar: string;
};

const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Total del documento: tarifa por persona × cantidad de personas + extras.
 */
export function totalActividad(
  tarifa: string | number | null | undefined,
  personas: string | number | null | undefined,
  montoExtras: string | number | null | undefined,
): number {
  return num(tarifa) * num(personas) + num(montoExtras);
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
    // Si la casilla está desmarcada el evento no lleva entradas: se limpian
    // las que hubiera, en vez de dejarlas escondidas.
    await sincronizarEntradas(id, input.cabecera.tiene_tickets ? input.entradas : []);
    return id;
  },
};
