import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { createCrudHooks } from '@/lib/createCrudHooks';
import {
  attActividadesApi,
  attActividadTicketsApi,
  attActividadSubticketsApi,
  type AttActividad,
  type AttActividadInsert,
  type AttActividadUpdate,
  type AttActividadTicket,
  type AttActividadTicketInsert,
  type AttActividadTicketUpdate,
  type AttActividadSubticket,
  type AttActividadSubticketInsert,
  type AttActividadSubticketUpdate,
} from './api';

// Padre: att_actividades (CRUD estándar).
export const {
  queryKey: attActividadesKey,
  useList: useAttActividades,
  useCreate: useCreateAttActividad,
  useUpdate: useUpdateAttActividad,
  useDelete: useDeleteAttActividad,
} = createCrudHooks<AttActividad, AttActividadInsert, AttActividadUpdate>('att_actividades', attActividadesApi);

// Hijos: att_actividad_tickets (por actividad).
export function attActividadTicketsKey(actividadId: string): QueryKey {
  return ['att_actividad_tickets', actividadId];
}

export function useAttActividadTickets(actividadId: string | null | undefined) {
  return useQuery<AttActividadTicket[], Error>({
    queryKey: attActividadTicketsKey(actividadId ?? ''),
    queryFn: () => attActividadTicketsApi.listByActividad(actividadId ?? ''),
    enabled: !!actividadId,
  });
}

export function useCreateAttActividadTicket() {
  const qc = useQueryClient();
  return useMutation<AttActividadTicket, Error, AttActividadTicketInsert>({
    mutationFn: (input) => attActividadTicketsApi.create(input),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attActividadTicketsKey(row.actividad_id) });
    },
  });
}

export function useUpdateAttActividadTicket() {
  const qc = useQueryClient();
  return useMutation<AttActividadTicket, Error, { id: string; patch: AttActividadTicketUpdate }>({
    mutationFn: ({ id, patch }) => attActividadTicketsApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attActividadTicketsKey(row.actividad_id) });
    },
  });
}

export function useDeleteAttActividadTicket() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; actividadId: string }>({
    mutationFn: ({ id }) => attActividadTicketsApi.remove(id),
    onSuccess: (_v, { actividadId }) => {
      void qc.invalidateQueries({ queryKey: attActividadTicketsKey(actividadId) });
    },
  });
}

// Nietos: att_actividad_subtickets (por ticket de actividad).
export function attActividadSubticketsKey(ticketId: string): QueryKey {
  return ['att_actividad_subtickets', ticketId];
}

export function useAttActividadSubtickets(ticketId: string | null | undefined) {
  return useQuery<AttActividadSubticket[], Error>({
    queryKey: attActividadSubticketsKey(ticketId ?? ''),
    queryFn: () => attActividadSubticketsApi.listByTicket(ticketId ?? ''),
    enabled: !!ticketId,
  });
}

export function useCreateAttActividadSubticket() {
  const qc = useQueryClient();
  return useMutation<AttActividadSubticket, Error, AttActividadSubticketInsert>({
    mutationFn: (input) => attActividadSubticketsApi.create(input),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attActividadSubticketsKey(row.ticket_id) });
    },
  });
}

export function useUpdateAttActividadSubticket() {
  const qc = useQueryClient();
  return useMutation<AttActividadSubticket, Error, { id: string; patch: AttActividadSubticketUpdate }>({
    mutationFn: ({ id, patch }) => attActividadSubticketsApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attActividadSubticketsKey(row.ticket_id) });
    },
  });
}

export function useDeleteAttActividadSubticket() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; ticketId: string }>({
    mutationFn: ({ id }) => attActividadSubticketsApi.remove(id),
    onSuccess: (_v, { ticketId }) => {
      void qc.invalidateQueries({ queryKey: attActividadSubticketsKey(ticketId) });
    },
  });
}
