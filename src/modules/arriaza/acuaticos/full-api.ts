// Fase 22 · traslado acuatico.
//
// La ruta puede ser OW o RT. Cuando es RT los campos de retorno viven en las
// columnas `ret_*` del mismo registro, asi que tampoco hay tablas hijas.
//
// El total es tarifa + extras, la formula que comparten los tres servicios de
// este documento; vive en shared/tarifaExtras.ts.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export { totalTarifaExtras } from '../shared/tarifaExtras';

export type AttAcuatico = Database['public']['Tables']['att_acuaticos']['Row'];
export type AttAcuaticoInsert = Database['public']['Tables']['att_acuaticos']['Insert'];

export async function subirConfirmacionAcuatico(id: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `acuaticos/${id}/confirmacion.${Date.now()}.${ext}`;
  const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from('att_acuaticos')
    .update({ confirmacion_path: path })
    .eq('id', id);
  if (error) throw error;
  return path;
}

export const acuaticosFullApi = {
  async load(id: string): Promise<AttAcuatico | null> {
    const { data, error } = await supabase
      .from('att_acuaticos').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data;
  },

  async save(input: { id?: string; cabecera: AttAcuaticoInsert }): Promise<string> {
    if (input.id) {
      const patch = { ...input.cabecera } as Record<string, unknown>;
      for (const k of ['id', 'viaje_id', 'created_at', 'created_by']) delete patch[k];
      const { error } = await supabase
        .from('att_acuaticos')
        .update(patch as Database['public']['Tables']['att_acuaticos']['Update'])
        .eq('id', input.id);
      if (error) throw error;
      return input.id;
    }
    const { data, error } = await supabase
      .from('att_acuaticos').insert(input.cabecera).select('id').single();
    if (error) throw error;
    return data.id;
  },
};
