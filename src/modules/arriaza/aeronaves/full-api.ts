// Fase 22 · renta de aeronave privada.
//
// La aeronave tiene una ruta simple -- origen y destino, una fecha y una hora --
// asi que todo cabe en su propio registro y no hay tablas hijas que reconciliar.
//
// El total es tarifa + extras, la formula que comparten los tres servicios de
// este documento; vive en shared/tarifaExtras.ts.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export { totalTarifaExtras } from '../shared/tarifaExtras';

export type AttAeronave = Database['public']['Tables']['att_aeronaves']['Row'];
export type AttAeronaveInsert = Database['public']['Tables']['att_aeronaves']['Insert'];

export async function subirConfirmacionAeronave(id: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `aeronaves/${id}/confirmacion.${Date.now()}.${ext}`;
  const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from('att_aeronaves')
    .update({ confirmacion_path: path })
    .eq('id', id);
  if (error) throw error;
  return path;
}

export const aeronavesFullApi = {
  async load(id: string): Promise<AttAeronave | null> {
    const { data, error } = await supabase
      .from('att_aeronaves').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data;
  },

  async save(input: { id?: string; cabecera: AttAeronaveInsert }): Promise<string> {
    if (input.id) {
      const patch = { ...input.cabecera } as Record<string, unknown>;
      for (const k of ['id', 'viaje_id', 'created_at', 'created_by']) delete patch[k];
      const { error } = await supabase
        .from('att_aeronaves')
        .update(patch as Database['public']['Tables']['att_aeronaves']['Update'])
        .eq('id', input.id);
      if (error) throw error;
      return input.id;
    }
    const { data, error } = await supabase
      .from('att_aeronaves').insert(input.cabecera).select('id').single();
    if (error) throw error;
    return data.id;
  },
};
