import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttFerry = Database['public']['Tables']['att_ferries']['Row'];
export type AttFerryInsert = Database['public']['Tables']['att_ferries']['Insert'];
export type AttFerryUpdate = Database['public']['Tables']['att_ferries']['Update'];

export const attFerriesApi: CrudApi<AttFerry, AttFerryInsert, AttFerryUpdate> & {
  listByViaje(viajeId: string): Promise<AttFerry[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_ferries').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_ferries').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_ferries').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_ferries').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_ferries')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

// ttFerryTotal · tarifa + monto_extras.
export function ferryTotal(x: AttFerry): number {
  return Number(x.tarifa ?? 0) + Number(x.monto_extras ?? 0);
}
