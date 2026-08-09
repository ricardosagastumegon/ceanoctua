import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttRuta = Database['public']['Tables']['att_rutas']['Row'];
export type AttRutaInsert = Database['public']['Tables']['att_rutas']['Insert'];
export type AttRutaUpdate = Database['public']['Tables']['att_rutas']['Update'];

export const attRutasApi: CrudApi<AttRuta, AttRutaInsert, AttRutaUpdate> & {
  listByViaje(viajeId: string): Promise<AttRuta[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_rutas').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_rutas').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_rutas').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_rutas').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_rutas')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

export function rutaTotal(_x: AttRuta): number {
  return 0;
}
