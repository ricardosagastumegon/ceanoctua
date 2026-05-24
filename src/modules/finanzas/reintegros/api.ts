import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Reintegro = Database['public']['Tables']['reintegros']['Row'];
export type ReintegroInsert = Database['public']['Tables']['reintegros']['Insert'];
export type ReintegroUpdate = Database['public']['Tables']['reintegros']['Update'];

export const reintegrosApi = {
  async list(): Promise<Reintegro[]> {
    const { data, error } = await supabase
      .from('reintegros')
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: ReintegroInsert): Promise<Reintegro> {
    const { data, error } = await supabase.from('reintegros').insert(input).select('*').single();
    if (error) throw error;
    // Update the linked consumo's reintegro_id
    if (data.consumo_id) {
      await supabase.from('tc_consumos').update({ reintegro_id: data.id }).eq('id', data.consumo_id);
    }
    return data;
  },
  async update(id: string, patch: ReintegroUpdate): Promise<Reintegro> {
    const { data, error } = await supabase.from('reintegros').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('reintegros').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};
