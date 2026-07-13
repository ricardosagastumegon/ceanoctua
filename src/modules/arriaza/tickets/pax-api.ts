import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type TicketPax = Database['public']['Tables']['att_ticket_pax']['Row'];
export type TicketPaxInsert = Database['public']['Tables']['att_ticket_pax']['Insert'];

export const PAX_TIPOS = [
  { value: 'AD', label: 'AD · Adulto' },
  { value: 'CHD', label: 'CHD · Niño' },
  { value: 'INF', label: 'INF · Infante' },
  { value: 'SSA', label: 'SSA · Senior' },
] as const;

export const ticketPaxApi = {
  async listByTicket(ticketId: string): Promise<TicketPax[]> {
    const { data, error } = await supabase
      .from('att_ticket_pax')
      .select('*')
      .eq('ticket_id', ticketId)
      .is('deleted_at', null)
      .order('orden', { ascending: true, nullsFirst: false })
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  },
  async create(input: TicketPaxInsert): Promise<TicketPax> {
    const { data, error } = await supabase.from('att_ticket_pax').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    // Soft delete · invariante 6 · CLAUDE.md §4.
    const { error } = await supabase
      .from('att_ticket_pax')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

const keys = (ticketId: string) => ['att_ticket_pax', ticketId] as const;

export function useTicketPax(ticketId: string | undefined) {
  return useQuery({
    queryKey: ticketId ? keys(ticketId) : ['noop-tp'],
    queryFn: () => ticketPaxApi.listByTicket(ticketId as string),
    enabled: !!ticketId,
  });
}
export function useCreateTicketPax(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<TicketPaxInsert, 'ticket_id'>) =>
      ticketPaxApi.create({ ...input, ticket_id: ticketId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys(ticketId) }),
  });
}
export function useDeleteTicketPax(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ticketPaxApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys(ticketId) }),
  });
}
