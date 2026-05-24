import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Directorio = Database['public']['Tables']['directorio']['Row'];
export type DirectorioInsert = Database['public']['Tables']['directorio']['Insert'];
export type DirectorioUpdate = Database['public']['Tables']['directorio']['Update'];

export const directorioApi = {
  async list(): Promise<Directorio[]> {
    const { data, error } = await supabase.from('directorio').select('*').order('nombre');
    if (error) throw error;
    return data ?? [];
  },
  async create(input: DirectorioInsert): Promise<Directorio> {
    const { data, error } = await supabase.from('directorio').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: DirectorioUpdate): Promise<Directorio> {
    const { data, error } = await supabase.from('directorio').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('directorio').delete().eq('id', id);
    if (error) throw error;
  },
};
