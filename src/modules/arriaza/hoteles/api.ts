import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttHotel = Database['public']['Tables']['att_hoteles']['Row'];
export type AttHotelInsert = Database['public']['Tables']['att_hoteles']['Insert'];
export type AttHotelUpdate = Database['public']['Tables']['att_hoteles']['Update'];

export const hotelesApi = {
  async listByViaje(viajeId: string): Promise<AttHotel[]> {
    const { data, error } = await supabase
      .from('att_hoteles')
      .select('*')
      .eq('viaje_id', viajeId)
      .order('checkin', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: AttHotelInsert): Promise<AttHotel> {
    const { data, error } = await supabase.from('att_hoteles').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AttHotelUpdate): Promise<AttHotel> {
    const { data, error } = await supabase.from('att_hoteles').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('att_hoteles').delete().eq('id', id);
    if (error) throw error;
  },
};
