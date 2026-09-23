// Fase 22 · servicio ferry.
//
// Misma forma que el traslado acuatico: ruta OW o RT en el mismo registro. Lo
// propio del ferry es `servicio_para`, que distingue si viajan personas,
// vehiculos o ambos.
//
// El total es tarifa + extras, la formula que comparten los tres servicios de
// este documento; vive en shared/tarifaExtras.ts.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export { totalTarifaExtras } from '../shared/tarifaExtras';

export type AttFerry = Database['public']['Tables']['att_ferries']['Row'];
export type AttFerryInsert = Database['public']['Tables']['att_ferries']['Insert'];

export async function subirConfirmacionFerry(id: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `ferries/${id}/confirmacion.${Date.now()}.${ext}`;
  const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from('att_ferries')
    .update({ confirmacion_path: path })
    .eq('id', id);
  if (error) throw error;
  return path;
}

export const ferriesFullApi = {
  async load(id: string): Promise<AttFerry | null> {
    const { data, error } = await supabase
      .from('att_ferries').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data;
  },

  async save(input: { id?: string; cabecera: AttFerryInsert }): Promise<string> {
    if (input.id) {
      const patch = { ...input.cabecera } as Record<string, unknown>;
      for (const k of ['id', 'viaje_id', 'created_at', 'created_by']) delete patch[k];
      const { error } = await supabase
        .from('att_ferries')
        .update(patch as Database['public']['Tables']['att_ferries']['Update'])
        .eq('id', input.id);
      if (error) throw error;
      return input.id;
    }
    const { data, error } = await supabase
      .from('att_ferries').insert(input.cabecera).select('id').single();
    if (error) throw error;
    return data.id;
  },
};
