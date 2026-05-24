import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Tarea = Database['public']['Tables']['tareas']['Row'];
export type TareaInsert = Database['public']['Tables']['tareas']['Insert'];
export type TareaUpdate = Database['public']['Tables']['tareas']['Update'];

export const tareasApi = {
  async listByMiembro(miembroId: string): Promise<Tarea[]> {
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('miembro_id', miembroId)
      .order('done', { ascending: true })
      .order('fecha', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: TareaInsert): Promise<Tarea> {
    const { data, error } = await supabase.from('tareas').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: TareaUpdate): Promise<Tarea> {
    const { data, error } = await supabase.from('tareas').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async toggleDone(id: string, done: boolean): Promise<void> {
    const { error } = await supabase.from('tareas').update({ done }).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('tareas').delete().eq('id', id);
    if (error) throw error;
  },
};
