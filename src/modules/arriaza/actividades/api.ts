import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttActividad = Database['public']['Tables']['att_actividades']['Row'];
export type AttActividadInsert = Database['public']['Tables']['att_actividades']['Insert'];
export type AttActividadUpdate = Database['public']['Tables']['att_actividades']['Update'];

export type AttActividadTicket = Database['public']['Tables']['att_actividad_tickets']['Row'];
export type AttActividadTicketInsert = Database['public']['Tables']['att_actividad_tickets']['Insert'];
export type AttActividadTicketUpdate = Database['public']['Tables']['att_actividad_tickets']['Update'];

export type AttActividadSubticket = Database['public']['Tables']['att_actividad_subtickets']['Row'];
export type AttActividadSubticketInsert = Database['public']['Tables']['att_actividad_subtickets']['Insert'];
export type AttActividadSubticketUpdate = Database['public']['Tables']['att_actividad_subtickets']['Update'];

/**
 * Cascade soft delete: al borrar una actividad, propaga deleted_at a sus
 * tickets y sub-tickets. Como el on delete cascade físico NO se dispara con
 * UPDATE, hay que iterar manualmente (pattern establecido en viajes/api.ts).
 */
async function cascadeSoftDeleteActividad(actividadId: string, deletedAt: string): Promise<void> {
  // 1) IDs de tickets vivos.
  const ticketsQ = await supabase
    .from('att_actividad_tickets')
    .select('id')
    .eq('actividad_id', actividadId)
    .is('deleted_at', null);
  if (ticketsQ.error) throw ticketsQ.error;
  const ticketIds = (ticketsQ.data ?? []).map((r) => r.id);

  // 2) Sub-tickets vivos de esos tickets.
  if (ticketIds.length > 0) {
    const rSub = await supabase
      .from('att_actividad_subtickets')
      .update({ deleted_at: deletedAt })
      .in('ticket_id', ticketIds)
      .is('deleted_at', null);
    if (rSub.error) throw rSub.error;
  }

  // 3) Tickets.
  const rTk = await supabase
    .from('att_actividad_tickets')
    .update({ deleted_at: deletedAt })
    .eq('actividad_id', actividadId)
    .is('deleted_at', null);
  if (rTk.error) throw rTk.error;
}

export const attActividadesApi: CrudApi<AttActividad, AttActividadInsert, AttActividadUpdate> & {
  listByViaje(viajeId: string): Promise<AttActividad[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_actividades').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_actividades').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('fecha', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_actividades').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_actividades').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const now = new Date().toISOString();
    await cascadeSoftDeleteActividad(id, now);
    const { error } = await supabase.from('att_actividades')
      .update({ deleted_at: now }).eq('id', id);
    if (error) throw error;
  },
};

// ttActTicketTotal: (tarifa × personas) + monto_extras.
export function actividadTicketTotal(at: AttActividadTicket): number {
  return Number(at.tarifa ?? 0) * Number(at.personas ?? 0) + Number(at.monto_extras ?? 0);
}

// ttActividadTotal: gran total de todos los tickets de la actividad.
export function actividadTotal(tickets: AttActividadTicket[]): number {
  return tickets.reduce((s, at) => s + actividadTicketTotal(at), 0);
}

// ==============================================================
// CRUD para tickets y sub-tickets — hand-written porque son hijos
// del hijo, no del viaje. También llevan cascade en el ticket.
// ==============================================================

async function cascadeSoftDeleteTicket(ticketId: string, deletedAt: string): Promise<void> {
  const rSub = await supabase
    .from('att_actividad_subtickets')
    .update({ deleted_at: deletedAt })
    .eq('ticket_id', ticketId)
    .is('deleted_at', null);
  if (rSub.error) throw rSub.error;
}

export const attActividadTicketsApi = {
  async listByActividad(actividadId: string): Promise<AttActividadTicket[]> {
    const { data, error } = await supabase
      .from('att_actividad_tickets')
      .select('*')
      .eq('actividad_id', actividadId)
      .is('deleted_at', null)
      .order('orden', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: AttActividadTicketInsert): Promise<AttActividadTicket> {
    const { data, error } = await supabase
      .from('att_actividad_tickets').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AttActividadTicketUpdate): Promise<AttActividadTicket> {
    const { data, error } = await supabase
      .from('att_actividad_tickets').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const now = new Date().toISOString();
    await cascadeSoftDeleteTicket(id, now);
    const { error } = await supabase
      .from('att_actividad_tickets').update({ deleted_at: now }).eq('id', id);
    if (error) throw error;
  },
};

export const attActividadSubticketsApi = {
  async listByTicket(ticketId: string): Promise<AttActividadSubticket[]> {
    const { data, error } = await supabase
      .from('att_actividad_subtickets')
      .select('*')
      .eq('ticket_id', ticketId)
      .is('deleted_at', null)
      .order('orden', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: AttActividadSubticketInsert): Promise<AttActividadSubticket> {
    const { data, error } = await supabase
      .from('att_actividad_subtickets').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AttActividadSubticketUpdate): Promise<AttActividadSubticket> {
    const { data, error } = await supabase
      .from('att_actividad_subtickets').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('att_actividad_subtickets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
