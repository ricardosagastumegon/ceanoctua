import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttAeronave = Database['public']['Tables']['att_aeronaves']['Row'];
export type AttAeronaveInsert = Database['public']['Tables']['att_aeronaves']['Insert'];
export type AttAeronaveUpdate = Database['public']['Tables']['att_aeronaves']['Update'];

export const attAeronavesApi: CrudApi<AttAeronave, AttAeronaveInsert, AttAeronaveUpdate> & {
  listByViaje(viajeId: string): Promise<AttAeronave[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_aeronaves').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_aeronaves').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_aeronaves').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_aeronaves').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_aeronaves')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

// ttAeronaveTotal · tarifa + monto_extras.
export function aeronaveTotal(x: AttAeronave): number {
  return Number(x.tarifa ?? 0) + Number(x.monto_extras ?? 0);
}
