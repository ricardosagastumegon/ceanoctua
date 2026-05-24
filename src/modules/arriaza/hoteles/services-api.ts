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
    const { error } = await supabase.from('att_hotel_services').delete().eq('id', id);
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
