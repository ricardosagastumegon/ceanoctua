import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  attHotelHabitacionesApi,
  type AttHotelHabitacion,
  type AttHotelHabitacionInsert,
  type AttHotelHabitacionUpdate,
} from './habitaciones-api';

export function attHotelHabitacionesKey(hotelId: string): QueryKey {
  return ['att_hotel_habitaciones', hotelId];
}

export function useAttHotelHabitaciones(hotelId: string | null | undefined) {
  return useQuery<AttHotelHabitacion[], Error>({
    queryKey: attHotelHabitacionesKey(hotelId ?? ''),
    queryFn: () => attHotelHabitacionesApi.listByHotel(hotelId ?? ''),
    enabled: !!hotelId,
  });
}

export function useCreateAttHotelHabitacion() {
  const qc = useQueryClient();
  return useMutation<AttHotelHabitacion, Error, AttHotelHabitacionInsert>({
    mutationFn: (input) => attHotelHabitacionesApi.create(input),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attHotelHabitacionesKey(row.hotel_id) });
    },
  });
}

export function useUpdateAttHotelHabitacion() {
  const qc = useQueryClient();
  return useMutation<AttHotelHabitacion, Error, { id: string; patch: AttHotelHabitacionUpdate }>({
    mutationFn: ({ id, patch }) => attHotelHabitacionesApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attHotelHabitacionesKey(row.hotel_id) });
    },
  });
}

export function useDeleteAttHotelHabitacion() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; hotelId: string }>({
    mutationFn: ({ id }) => attHotelHabitacionesApi.remove(id),
    onSuccess: (_v, { hotelId }) => {
      void qc.invalidateQueries({ queryKey: attHotelHabitacionesKey(hotelId) });
    },
  });
}
