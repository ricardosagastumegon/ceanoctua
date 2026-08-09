// Extensión de hoteles · F19-1 · habitaciones múltiples por hotel.
// Cada att_hotel se puede tener N att_hotel_habitaciones (paridad hotel.rooms[] del HTML).

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttHotelHabitacion = Database['public']['Tables']['att_hotel_habitaciones']['Row'];
export type AttHotelHabitacionInsert = Database['public']['Tables']['att_hotel_habitaciones']['Insert'];
export type AttHotelHabitacionUpdate = Database['public']['Tables']['att_hotel_habitaciones']['Update'];

export const attHotelHabitacionesApi = {
  async listByHotel(hotelId: string): Promise<AttHotelHabitacion[]> {
    const { data, error } = await supabase
      .from('att_hotel_habitaciones')
      .select('*')
      .eq('hotel_id', hotelId)
      .is('deleted_at', null)
      .order('orden', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: AttHotelHabitacionInsert): Promise<AttHotelHabitacion> {
    const { data, error } = await supabase
      .from('att_hotel_habitaciones').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AttHotelHabitacionUpdate): Promise<AttHotelHabitacion> {
    const { data, error } = await supabase
      .from('att_hotel_habitaciones').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('att_hotel_habitaciones')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

// ttRoomTotal: tarifa × noches por habitación.
export function habitacionTotal(r: AttHotelHabitacion): number {
  return Number(r.tarifa ?? 0) * Number(r.noches ?? 0);
}

// Suma de todas las habitaciones de un hotel.
export function habitacionesTotal(rooms: AttHotelHabitacion[]): number {
  return rooms.reduce((s, r) => s + habitacionTotal(r), 0);
}
