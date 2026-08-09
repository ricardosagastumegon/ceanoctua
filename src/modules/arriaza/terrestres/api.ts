import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttTerrestre = Database['public']['Tables']['att_terrestres']['Row'];
export type AttTerrestreInsert = Database['public']['Tables']['att_terrestres']['Insert'];
export type AttTerrestreUpdate = Database['public']['Tables']['att_terrestres']['Update'];

export const attTerrestresApi: CrudApi<AttTerrestre, AttTerrestreInsert, AttTerrestreUpdate> & {
  listByViaje(viajeId: string): Promise<AttTerrestre[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_terrestres').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_terrestres').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_terrestres').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_terrestres').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_terrestres')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

// ttTerrestreTotal · tarifa × personas + monto_extras.
export function terrestreTotal(x: AttTerrestre): number {
  return Number(x.tarifa ?? 0) * Number(x.personas ?? 0) + Number(x.monto_extras ?? 0);
}
