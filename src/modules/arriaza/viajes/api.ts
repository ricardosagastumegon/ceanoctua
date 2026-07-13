import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttViaje = Database['public']['Tables']['att_viajes']['Row'];
export type AttViajeInsert = Database['public']['Tables']['att_viajes']['Insert'];
export type AttViajeUpdate = Database['public']['Tables']['att_viajes']['Update'];

// Cascade soft-delete: al borrar suavemente un viaje, propagar deleted_at a
// todos sus hijos. El `on delete cascade` físico (fase 7 / fase 13) NO se
// dispara en un UPDATE — hay que propagar manualmente.
//
// Nivel 1 (hijos directos del viaje):
//   att_tickets, att_hoteles, att_restaurantes, att_pins
// Nivel 2 (nietos, hijos de los hijos):
//   att_ticket_pax, att_ticket_segments, att_ticket_pay_records
//   att_hotel_services, att_hotel_pay_records
//   att_restaurant_diners, att_restaurant_services, att_restaurant_pay_records
async function cascadeSoftDeleteViaje(viajeId: string, deletedAt: string): Promise<void> {
  // Fetch IDs de los hijos directos para poder alcanzar los nietos.
  const ticketsQ = await supabase
    .from('att_tickets').select('id').eq('viaje_id', viajeId).is('deleted_at', null);
  if (ticketsQ.error) throw ticketsQ.error;
  const hotelesQ = await supabase
    .from('att_hoteles').select('id').eq('viaje_id', viajeId).is('deleted_at', null);
  if (hotelesQ.error) throw hotelesQ.error;
  const restaurantesQ = await supabase
    .from('att_restaurantes').select('id').eq('viaje_id', viajeId).is('deleted_at', null);
  if (restaurantesQ.error) throw restaurantesQ.error;

  const ticketIds = (ticketsQ.data ?? []).map((r) => r.id);
  const hotelIds = (hotelesQ.data ?? []).map((r) => r.id);
  const restauranteIds = (restaurantesQ.data ?? []).map((r) => r.id);

  // Nivel 2: nietos (solo si hay padres alcanzados).
  if (ticketIds.length > 0) {
    const rPax = await supabase.from('att_ticket_pax')
      .update({ deleted_at: deletedAt }).in('ticket_id', ticketIds).is('deleted_at', null);
    if (rPax.error) throw rPax.error;
    const rSeg = await supabase.from('att_ticket_segments')
      .update({ deleted_at: deletedAt }).in('ticket_id', ticketIds).is('deleted_at', null);
    if (rSeg.error) throw rSeg.error;
    const rTpay = await supabase.from('att_ticket_pay_records')
      .update({ deleted_at: deletedAt }).in('ticket_id', ticketIds).is('deleted_at', null);
    if (rTpay.error) throw rTpay.error;
  }
  if (hotelIds.length > 0) {
    const rSvc = await supabase.from('att_hotel_services')
      .update({ deleted_at: deletedAt }).in('hotel_id', hotelIds).is('deleted_at', null);
    if (rSvc.error) throw rSvc.error;
    const rHpay = await supabase.from('att_hotel_pay_records')
      .update({ deleted_at: deletedAt }).in('hotel_id', hotelIds).is('deleted_at', null);
    if (rHpay.error) throw rHpay.error;
  }
  if (restauranteIds.length > 0) {
    const rDin = await supabase.from('att_restaurant_diners')
      .update({ deleted_at: deletedAt }).in('restaurante_id', restauranteIds).is('deleted_at', null);
    if (rDin.error) throw rDin.error;
    const rRsvc = await supabase.from('att_restaurant_services')
      .update({ deleted_at: deletedAt }).in('restaurante_id', restauranteIds).is('deleted_at', null);
    if (rRsvc.error) throw rRsvc.error;
    const rRpay = await supabase.from('att_restaurant_pay_records')
      .update({ deleted_at: deletedAt }).in('restaurante_id', restauranteIds).is('deleted_at', null);
    if (rRpay.error) throw rRpay.error;
  }

  // Nivel 1: hijos directos (incluye att_pins por uniformidad).
  // Nota: att_pins no está en types (no hay código que la use), así que la
  // llamada se hace via `from(... as never)` para saltar la validación de tipos.
  const rTk = await supabase.from('att_tickets')
    .update({ deleted_at: deletedAt }).eq('viaje_id', viajeId).is('deleted_at', null);
  if (rTk.error) throw rTk.error;
  const rHt = await supabase.from('att_hoteles')
    .update({ deleted_at: deletedAt }).eq('viaje_id', viajeId).is('deleted_at', null);
  if (rHt.error) throw rHt.error;
  const rRt = await supabase.from('att_restaurantes')
    .update({ deleted_at: deletedAt }).eq('viaje_id', viajeId).is('deleted_at', null);
  if (rRt.error) throw rRt.error;
  // att_pins: sin type — la migración fase 19-0 agrega la columna pero types
  // no la refleja porque no la usa ningún componente. Cast a unknown para
  // aplicar el soft delete uniforme.
  const client = supabase as unknown as {
    from: (n: string) => {
      update: (v: unknown) => {
        eq: (c: string, v: unknown) => {
          is: (c: string, v: unknown) => Promise<{ error: Error | null }>;
        };
      };
    };
  };
  const rPins = await client.from('att_pins')
    .update({ deleted_at: deletedAt }).eq('viaje_id', viajeId).is('deleted_at', null);
  if (rPins.error) throw rPins.error;
}

export const attViajesApi = {
  async list(): Promise<AttViaje[]> {
    const { data, error } = await supabase
      .from('att_viajes')
      .select('*')
      .is('deleted_at', null)
      .order('fecha_ini', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async get(id: string): Promise<AttViaje | null> {
    const { data, error } = await supabase
      .from('att_viajes')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async create(input: AttViajeInsert): Promise<AttViaje> {
    const { data, error } = await supabase.from('att_viajes').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AttViajeUpdate): Promise<AttViaje> {
    const { data, error } = await supabase.from('att_viajes').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    // Soft delete: cascada explícita a hijos y nietos primero, luego padre.
    // Invariante 6 · CLAUDE.md §4 · nunca DELETE físico en tablas de negocio.
    const now = new Date().toISOString();
    await cascadeSoftDeleteViaje(id, now);
    const { error } = await supabase
      .from('att_viajes')
      .update({ deleted_at: now })
      .eq('id', id);
    if (error) throw error;
  },
};
