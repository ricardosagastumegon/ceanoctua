import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Evento = Database['public']['Tables']['eventos']['Row'];
export type EventoInsert = Database['public']['Tables']['eventos']['Insert'];
export type EventoUpdate = Database['public']['Tables']['eventos']['Update'];

export const eventosApi = {
  async listByMiembro(miembroId: string): Promise<Evento[]> {
    const { data, error } = await supabase
      .from('eventos')
      .select('*')
      .eq('miembro_id', miembroId)
      .order('fecha', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: EventoInsert): Promise<Evento> {
    const { data, error } = await supabase.from('eventos').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: EventoUpdate): Promise<Evento> {
    const { data, error } = await supabase.from('eventos').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('eventos').delete().eq('id', id);
    if (error) throw error;
  },
};
