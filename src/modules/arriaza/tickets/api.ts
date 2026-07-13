import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttTicket = Database['public']['Tables']['att_tickets']['Row'];
export type AttTicketInsert = Database['public']['Tables']['att_tickets']['Insert'];
export type AttTicketUpdate = Database['public']['Tables']['att_tickets']['Update'];

// Cascade soft-delete: al borrar un ticket, propagar a pax/segments/pay_records.
async function cascadeSoftDeleteTicket(ticketId: string, deletedAt: string): Promise<void> {
  const rPax = await supabase.from('att_ticket_pax')
    .update({ deleted_at: deletedAt }).eq('ticket_id', ticketId).is('deleted_at', null);
  if (rPax.error) throw rPax.error;
  const rSeg = await supabase.from('att_ticket_segments')
    .update({ deleted_at: deletedAt }).eq('ticket_id', ticketId).is('deleted_at', null);
  if (rSeg.error) throw rSeg.error;
  const rPay = await supabase.from('att_ticket_pay_records')
    .update({ deleted_at: deletedAt }).eq('ticket_id', ticketId).is('deleted_at', null);
  if (rPay.error) throw rPay.error;
}

export const ticketsApi = {
  async listByViaje(viajeId: string): Promise<AttTicket[]> {
    const { data, error } = await supabase
      .from('att_tickets')
      .select('*')
      .eq('viaje_id', viajeId)
      .is('deleted_at', null)
      .order('fecha_salida', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: AttTicketInsert): Promise<AttTicket> {
    const { data, error } = await supabase.from('att_tickets').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AttTicketUpdate): Promise<AttTicket> {
    const { data, error } = await supabase.from('att_tickets').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    // Soft delete + cascada a hijos (pax/segments/pay_records).
    // Invariante 6 · CLAUDE.md §4.
    const now = new Date().toISOString();
    await cascadeSoftDeleteTicket(id, now);
    const { error } = await supabase
      .from('att_tickets')
      .update({ deleted_at: now })
      .eq('id', id);
    if (error) throw error;
  },
};
