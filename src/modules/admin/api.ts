import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Entidad = Database['public']['Tables']['entidades']['Row'];
export type EntidadInsert = Database['public']['Tables']['entidades']['Insert'];
export type EntidadUpdate = Database['public']['Tables']['entidades']['Update'];

export const entidadesApi = {
  async list(): Promise<Entidad[]> {
    const { data, error } = await supabase
      .from('entidades')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: EntidadInsert): Promise<Entidad> {
    const { data, error } = await supabase.from('entidades').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: EntidadUpdate): Promise<Entidad> {
    const { data, error } = await supabase
      .from('entidades')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('entidades').delete().eq('id', id);
    if (error) throw error;
  },
};
