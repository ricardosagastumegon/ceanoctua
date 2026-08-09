import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttAcuatico = Database['public']['Tables']['att_acuaticos']['Row'];
export type AttAcuaticoInsert = Database['public']['Tables']['att_acuaticos']['Insert'];
export type AttAcuaticoUpdate = Database['public']['Tables']['att_acuaticos']['Update'];

export const attAcuaticosApi: CrudApi<AttAcuatico, AttAcuaticoInsert, AttAcuaticoUpdate> & {
  listByViaje(viajeId: string): Promise<AttAcuatico[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_acuaticos').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_acuaticos').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_acuaticos').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_acuaticos').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_acuaticos')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

// ttAcuaticoTotal · tarifa + monto_extras.
export function acuaticoTotal(x: AttAcuatico): number {
  return Number(x.tarifa ?? 0) + Number(x.monto_extras ?? 0);
}
