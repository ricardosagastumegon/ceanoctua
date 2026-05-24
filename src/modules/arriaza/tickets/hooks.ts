import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketsApi, type AttTicketInsert, type AttTicketUpdate } from './api';

const keys = { list: (viajeId: string | undefined) => ['att_tickets', viajeId] as const };

export function useTickets(viajeId: string | undefined) {
  return useQuery({
    queryKey: keys.list(viajeId),
    queryFn: () => ticketsApi.listByViaje(viajeId as string),
    enabled: !!viajeId,
  });
}
export function useCreateTicket(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttTicketInsert) => ticketsApi.create({ ...input, viaje_id: viajeId as string }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(viajeId) }),
  });
}
export function useUpdateTicket(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AttTicketUpdate }) => ticketsApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(viajeId) }),
  });
}
export function useDeleteTicket(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ticketsApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(viajeId) }),
  });
}
