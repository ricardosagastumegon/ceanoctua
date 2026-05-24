import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type CeaTodo = Database['public']['Tables']['cea_todos']['Row'];
export type CeaTodoInsert = Database['public']['Tables']['cea_todos']['Insert'];
export type CeaTodoUpdate = Database['public']['Tables']['cea_todos']['Update'];

export const ceaTodosApi = {
  async list(): Promise<CeaTodo[]> {
    const { data, error } = await supabase
      .from('cea_todos')
      .select('*')
      .order('done', { ascending: true })
      .order('fecha', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: CeaTodoInsert): Promise<CeaTodo> {
    const { data, error } = await supabase.from('cea_todos').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: CeaTodoUpdate): Promise<CeaTodo> {
    const { data, error } = await supabase.from('cea_todos').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async toggleDone(id: string, done: boolean): Promise<void> {
    const { error } = await supabase.from('cea_todos').update({ done }).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('cea_todos').delete().eq('id', id);
    if (error) throw error;
  },
};
