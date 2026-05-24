import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Lavanderia = Database['public']['Tables']['lavanderia']['Row'];
export type LavanderiaInsert = Database['public']['Tables']['lavanderia']['Insert'];
export type LavanderiaUpdate = Database['public']['Tables']['lavanderia']['Update'];

export const lavanderiaApi = {
  async list(): Promise<Lavanderia[]> {
    const { data, error } = await supabase
      .from('lavanderia')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: LavanderiaInsert): Promise<Lavanderia> {
    const { data, error } = await supabase.from('lavanderia').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: LavanderiaUpdate): Promise<Lavanderia> {
    const { data, error } = await supabase.from('lavanderia').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('lavanderia').delete().eq('id', id);
    if (error) throw error;
  },
};
