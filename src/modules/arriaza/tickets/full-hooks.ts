import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketFullApi, type PaxInput, type SegmentoInput } from './full-api';
import type { AttTicketInsert } from './full-api';
import { invalidarViaje } from '../viajes/invalidar';

export function useTicketCompleto(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['att_ticket_full', ticketId],
    queryFn: () => ticketFullApi.load(ticketId as string),
    enabled: !!ticketId,
  });
}

export function useSaveTicketCompleto(viajeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      ticketId?: string;
      cabecera: AttTicketInsert;
      pnrs: string[];
      segmentos: SegmentoInput[];
      pax: PaxInput[];
    }) => ticketFullApi.save(vars),
    onSuccess: (ticketId) => {
      void qc.invalidateQueries({ queryKey: ['att_tickets', viajeId] });
      void qc.invalidateQueries({ queryKey: ['att_ticket_full', ticketId] });
      // El total, los numeros del encabezado, la ruta del riel y el
      // itinerario salen de los servicios: hay que refrescarlos todos.
      invalidarViaje(qc, viajeId);
      void qc.invalidateQueries({ queryKey: ['att_viajes'] });
    },
  });
}
