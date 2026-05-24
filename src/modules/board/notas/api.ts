import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Nota = Database['public']['Tables']['notas']['Row'];
export type NotaInsert = Database['public']['Tables']['notas']['Insert'];
export type NotaUpdate = Database['public']['Tables']['notas']['Update'];

export const notasApi = {
  async listByMiembro(miembroId: string): Promise<Nota[]> {
    const { data, error } = await supabase
      .from('notas')
      .select('*')
      .eq('miembro_id', miembroId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: NotaInsert): Promise<Nota> {
    const { data, error } = await supabase.from('notas').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: NotaUpdate): Promise<Nota> {
    const { data, error } = await supabase.from('notas').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('notas').delete().eq('id', id);
    if (error) throw error;
  },
};
