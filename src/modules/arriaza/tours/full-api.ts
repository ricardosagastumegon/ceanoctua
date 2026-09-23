// Fase 22 · tours.
//
// El tour no tiene tablas hijas: todo cabe en su propio registro, así que
// guardar es un insert o un update y ya. Lo único que se calcula es el total.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttTour = Database['public']['Tables']['att_tours']['Row'];
export type AttTourInsert = Database['public']['Tables']['att_tours']['Insert'];

const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Total de la reserva: tarifa por persona × cantidad de personas, tal como lo
 * define el documento. Los días no multiplican — la tarifa ya es del tour
 * completo, no por día.
 */
export function totalTour(tarifa: string | number | null, personas: string | number | null): number {
  return num(tarifa) * num(personas);
}

export async function subirConfirmacionTour(id: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `tours/${id}/confirmacion.${Date.now()}.${ext}`;
  const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from('att_tours')
    .update({ confirmacion_path: path })
    .eq('id', id);
  if (error) throw error;
  return path;
}

export const tourFullApi = {
  async load(id: string): Promise<AttTour | null> {
    const { data, error } = await supabase
      .from('att_tours').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data;
  },

  async save(input: { id?: string; cabecera: AttTourInsert }): Promise<string> {
    if (input.id) {
      const patch = { ...input.cabecera } as Record<string, unknown>;
      for (const k of ['id', 'viaje_id', 'created_at', 'created_by']) delete patch[k];
      const { error } = await supabase
        .from('att_tours')
        .update(patch as Database['public']['Tables']['att_tours']['Update'])
        .eq('id', input.id);
      if (error) throw error;
      return input.id;
    }
    const { data, error } = await supabase
      .from('att_tours').insert(input.cabecera).select('id').single();
    if (error) throw error;
    return data.id;
  },
};
