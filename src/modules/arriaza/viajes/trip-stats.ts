// Números de cabecera del viaje: días, noches de hotel, ciudades y vuelos.
//
// Son los cuatro que el usuario quiere ver de un vistazo al abrir el viaje.
// Cada uno sale de donde de verdad vive el dato, no de un campo capturado a
// mano que se desincroniza:
//
//   días    · del rango de fechas del viaje
//   noches  · suma de las noches de los hoteles reservados
//   ciudades· las ciudades destino del viaje
//   vuelos  · los SEGMENTOS de los tickets, no los tickets: un ida y vuelta
//             con escala son varios vuelos en un solo boleto

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type TripStats = { noches: number; vuelos: number };

export function useTripStats(viajeId: string | undefined) {
  return useQuery({
    queryKey: ['att_trip_stats', viajeId],
    enabled: !!viajeId,
    queryFn: async (): Promise<TripStats> => {
      const id = viajeId as string;

      const hoteles = await supabase
        .from('att_hoteles')
        .select('nights')
        .eq('viaje_id', id)
        .is('deleted_at', null);
      if (hoteles.error) throw hoteles.error;

      const tickets = await supabase
        .from('att_tickets')
        .select('id')
        .eq('viaje_id', id)
        .is('deleted_at', null);
      if (tickets.error) throw tickets.error;

      let vuelos = 0;
      const ids = (tickets.data ?? []).map((t) => t.id);
      if (ids.length > 0) {
        const segs = await supabase
          .from('att_ticket_segments')
          .select('id', { count: 'exact', head: true })
          .in('ticket_id', ids)
          .is('deleted_at', null);
        if (segs.error) throw segs.error;
        vuelos = segs.count ?? 0;
      }

      return {
        noches: (hoteles.data ?? []).reduce((s, h) => s + (Number(h.nights) || 0), 0),
        vuelos,
      };
    },
  });
}
