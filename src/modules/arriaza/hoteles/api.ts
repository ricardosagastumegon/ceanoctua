import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttHotel = Database['public']['Tables']['att_hoteles']['Row'];
export type AttHotelInsert = Database['public']['Tables']['att_hoteles']['Insert'];
export type AttHotelUpdate = Database['public']['Tables']['att_hoteles']['Update'];

// Cascade soft-delete: hotel → services + pay_records.
async function cascadeSoftDeleteHotel(hotelId: string, deletedAt: string): Promise<void> {
  const rSvc = await supabase.from('att_hotel_services')
    .update({ deleted_at: deletedAt }).eq('hotel_id', hotelId).is('deleted_at', null);
  if (rSvc.error) throw rSvc.error;
  const rPay = await supabase.from('att_hotel_pay_records')
    .update({ deleted_at: deletedAt }).eq('hotel_id', hotelId).is('deleted_at', null);
  if (rPay.error) throw rPay.error;
}

export const hotelesApi = {
  async listByViaje(viajeId: string): Promise<AttHotel[]> {
    const { data, error } = await supabase
      .from('att_hoteles')
      .select('*')
      .eq('viaje_id', viajeId)
      .is('deleted_at', null)
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
    // Soft delete + cascada a hijos (services + pay_records).
    // Invariante 6 · CLAUDE.md §4.
    const now = new Date().toISOString();
    await cascadeSoftDeleteHotel(id, now);
    const { error } = await supabase
      .from('att_hoteles')
      .update({ deleted_at: now })
      .eq('id', id);
    if (error) throw error;
  },
};
