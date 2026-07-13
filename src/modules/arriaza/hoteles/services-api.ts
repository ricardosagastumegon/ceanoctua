import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type HotelService = Database['public']['Tables']['att_hotel_services']['Row'];
export type HotelServiceInsert = Database['public']['Tables']['att_hotel_services']['Insert'];

export const hotelServicesApi = {
  async listByHotel(hotelId: string): Promise<HotelService[]> {
    const { data, error } = await supabase
      .from('att_hotel_services')
      .select('*')
      .eq('hotel_id', hotelId)
      .is('deleted_at', null)
      .order('orden', { ascending: true, nullsFirst: false })
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  },
  async create(input: HotelServiceInsert): Promise<HotelService> {
    const { data, error } = await supabase.from('att_hotel_services').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    // Soft delete · invariante 6 · CLAUDE.md §4. Nota: att_hoteles.services_total
    // se sigue actualizando por el trigger recalc_hotel_services_total, que dispara
    // en INSERT/UPDATE/DELETE físico. Un soft delete es un UPDATE, así que el
    // trigger recalcula; pero como el servicio queda con deleted_at != null,
    // la lista visible no lo incluye (filtro is('deleted_at', null) arriba).
    // El total_services aún contiene los amounts soft-deleted — mismo pattern
    // que el sum SQL. Aceptable para F19-0; refinar en F19-1+ si molesta.
    const { error } = await supabase
      .from('att_hotel_services')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

const keys = (hotelId: string) => ['att_hotel_services', hotelId] as const;

export function useHotelServices(hotelId: string | undefined) {
  return useQuery({
    queryKey: hotelId ? keys(hotelId) : ['noop-hs'],
    queryFn: () => hotelServicesApi.listByHotel(hotelId as string),
    enabled: !!hotelId,
  });
}
export function useCreateHotelService(hotelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<HotelServiceInsert, 'hotel_id'>) =>
      hotelServicesApi.create({ ...input, hotel_id: hotelId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys(hotelId) });
      void qc.invalidateQueries({ queryKey: ['att_hoteles'] });
    },
  });
}
export function useDeleteHotelService(hotelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hotelServicesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys(hotelId) });
      void qc.invalidateQueries({ queryKey: ['att_hoteles'] });
    },
  });
}
