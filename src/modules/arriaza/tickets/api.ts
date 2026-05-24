import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttTicket = Database['public']['Tables']['att_tickets']['Row'];
export type AttTicketInsert = Database['public']['Tables']['att_tickets']['Insert'];
export type AttTicketUpdate = Database['public']['Tables']['att_tickets']['Update'];

export const ticketsApi = {
  async listByViaje(viajeId: string): Promise<AttTicket[]> {
    const { data, error } = await supabase
      .from('att_tickets')
      .select('*')
      .eq('viaje_id', viajeId)
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
    const { error } = await supabase.from('att_tickets').delete().eq('id', id);
    if (error) throw error;
  },
};
