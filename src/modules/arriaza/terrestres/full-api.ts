// Fase 22 · traslado terrestre.
//
// Misma forma que acuático y ferry -- ruta OW o RT en el mismo registro -- con
// una diferencia en el dinero: aquí la tarifa es POR PERSONA y multiplica por
// la cantidad, como en el tour. En acuático y ferry la tarifa es del servicio
// completo.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttTerrestre = Database['public']['Tables']['att_terrestres']['Row'];
export type AttTerrestreInsert = Database['public']['Tables']['att_terrestres']['Insert'];

const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Total del documento: tarifa por persona × cantidad de personas + extras.
 */
export function totalTerrestre(
  tarifa: string | number | null | undefined,
  personas: string | number | null | undefined,
  montoExtras: string | number | null | undefined,
): number {
  return num(tarifa) * num(personas) + num(montoExtras);
}

export async function subirConfirmacionTerrestre(id: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `terrestres/${id}/confirmacion.${Date.now()}.${ext}`;
  const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from('att_terrestres')
    .update({ confirmacion_path: path })
    .eq('id', id);
  if (error) throw error;
  return path;
}

export const terrestresFullApi = {
  async load(id: string): Promise<AttTerrestre | null> {
    const { data, error } = await supabase
      .from('att_terrestres').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data;
  },

  async save(input: { id?: string; cabecera: AttTerrestreInsert }): Promise<string> {
    if (input.id) {
      const patch = { ...input.cabecera } as Record<string, unknown>;
      for (const k of ['id', 'viaje_id', 'created_at', 'created_by']) delete patch[k];
      const { error } = await supabase
        .from('att_terrestres')
        .update(patch as Database['public']['Tables']['att_terrestres']['Update'])
        .eq('id', input.id);
      if (error) throw error;
      return input.id;
    }
    const { data, error } = await supabase
      .from('att_terrestres').insert(input.cabecera).select('id').single();
    if (error) throw error;
    return data.id;
  },
};
