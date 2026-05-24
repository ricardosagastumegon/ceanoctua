import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttRestaurante = Database['public']['Tables']['att_restaurantes']['Row'];
export type AttRestauranteInsert = Database['public']['Tables']['att_restaurantes']['Insert'];
export type AttRestauranteUpdate = Database['public']['Tables']['att_restaurantes']['Update'];

export const restaurantesApi = {
  async listByViaje(viajeId: string): Promise<AttRestaurante[]> {
    const { data, error } = await supabase
      .from('att_restaurantes')
      .select('*')
      .eq('viaje_id', viajeId)
      .order('fecha', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: AttRestauranteInsert): Promise<AttRestaurante> {
    const { data, error } = await supabase.from('att_restaurantes').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AttRestauranteUpdate): Promise<AttRestaurante> {
    const { data, error } = await supabase.from('att_restaurantes').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('att_restaurantes').delete().eq('id', id);
    if (error) throw error;
  },
};
