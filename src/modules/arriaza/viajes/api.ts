import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttViaje = Database['public']['Tables']['att_viajes']['Row'];
export type AttViajeInsert = Database['public']['Tables']['att_viajes']['Insert'];
export type AttViajeUpdate = Database['public']['Tables']['att_viajes']['Update'];

// Cascade soft-delete: al borrar suavemente un viaje, propagar deleted_at a
// todos sus hijos. El `on delete cascade` físico (fase 7 / 13 / 19-1) NO se
// dispara en un UPDATE — hay que propagar manualmente.
//
// Post-F19-1, el viaje ahora tiene 3 hijos preexistentes + 13 nuevos:
//
// Nivel 1 (hijos directos del viaje):
//   ORIGINALES: att_tickets, att_hoteles, att_restaurantes, att_pins
//   NUEVOS F19-1: att_rentas, att_tours, att_aeronaves, att_acuaticos,
//                 att_ferries, att_terrestres, att_tiendas, att_actividades,
//                 att_reuniones, att_rutas, att_pois, att_day_plans, att_day_notes
//
// Nivel 2 (nietos, hijos de los hijos):
//   ORIGINALES: att_ticket_pax, att_ticket_segments, att_ticket_pay_records,
//               att_hotel_services, att_hotel_pay_records,
//               att_restaurant_diners, att_restaurant_services, att_restaurant_pay_records
//   NUEVOS F19-1: att_hotel_habitaciones (bajo hoteles),
//                 att_actividad_tickets (bajo actividades),
//                 att_day_plan_rows (bajo day_plans)
//
// Nivel 3 (bisnietos):
//   NUEVOS F19-1: att_actividad_subtickets (bajo actividad_tickets)
async function cascadeSoftDeleteViaje(viajeId: string, deletedAt: string): Promise<void> {
  // ==========================================================
  // Fetch de IDs de padres directos (para alcanzar los hijos).
  // ==========================================================
  const ticketsQ = await supabase
    .from('att_tickets').select('id').eq('viaje_id', viajeId).is('deleted_at', null);
  if (ticketsQ.error) throw ticketsQ.error;
  const hotelesQ = await supabase
    .from('att_hoteles').select('id').eq('viaje_id', viajeId).is('deleted_at', null);
  if (hotelesQ.error) throw hotelesQ.error;
  const restaurantesQ = await supabase
    .from('att_restaurantes').select('id').eq('viaje_id', viajeId).is('deleted_at', null);
  if (restaurantesQ.error) throw restaurantesQ.error;
  const actividadesQ = await supabase
    .from('att_actividades').select('id').eq('viaje_id', viajeId).is('deleted_at', null);
  if (actividadesQ.error) throw actividadesQ.error;
  const dayPlansQ = await supabase
    .from('att_day_plans').select('id').eq('viaje_id', viajeId).is('deleted_at', null);
  if (dayPlansQ.error) throw dayPlansQ.error;

  const ticketIds = (ticketsQ.data ?? []).map((r) => r.id);
  const hotelIds = (hotelesQ.data ?? []).map((r) => r.id);
  const restauranteIds = (restaurantesQ.data ?? []).map((r) => r.id);
  const actividadIds = (actividadesQ.data ?? []).map((r) => r.id);
  const dayPlanIds = (dayPlansQ.data ?? []).map((r) => r.id);

  // ==========================================================
  // Nivel 3 (bisnietos): subtickets de tickets de actividad.
  // Se hace primero porque necesita IDs de nivel 2.
  // ==========================================================
  let actividadTicketIds: string[] = [];
  if (actividadIds.length > 0) {
    const tkQ = await supabase
      .from('att_actividad_tickets')
      .select('id')
      .in('actividad_id', actividadIds)
      .is('deleted_at', null);
    if (tkQ.error) throw tkQ.error;
    actividadTicketIds = (tkQ.data ?? []).map((r) => r.id);

    if (actividadTicketIds.length > 0) {
      const rSub = await supabase
        .from('att_actividad_subtickets')
        .update({ deleted_at: deletedAt })
        .in('ticket_id', actividadTicketIds)
        .is('deleted_at', null);
      if (rSub.error) throw rSub.error;
    }
  }

  // ==========================================================
  // Nivel 2 (nietos): hijos de tickets/hoteles/restaurantes/actividades/day_plans.
  // ==========================================================
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
    // F19-1 · nueva: habitaciones múltiples
    const rHab = await supabase.from('att_hotel_habitaciones')
      .update({ deleted_at: deletedAt }).in('hotel_id', hotelIds).is('deleted_at', null);
    if (rHab.error) throw rHab.error;
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
  if (actividadIds.length > 0) {
    // F19-1 · tickets de actividad (padres de los subtickets ya borrados arriba).
    const rActTk = await supabase.from('att_actividad_tickets')
      .update({ deleted_at: deletedAt }).in('actividad_id', actividadIds).is('deleted_at', null);
    if (rActTk.error) throw rActTk.error;
  }
  if (dayPlanIds.length > 0) {
    // F19-1 · rows del day_plan.
    const rDpr = await supabase.from('att_day_plan_rows')
      .update({ deleted_at: deletedAt }).in('day_plan_id', dayPlanIds).is('deleted_at', null);
    if (rDpr.error) throw rDpr.error;
  }

  // ==========================================================
  // Nivel 1 (hijos directos del viaje).
  // Un pequeño helper para no repetir 13 veces la misma cadena.
  // ==========================================================
  const level1Tables = [
    'att_tickets',
    'att_hoteles',
    'att_restaurantes',
    'att_rentas',
    'att_tours',
    'att_aeronaves',
    'att_acuaticos',
    'att_ferries',
    'att_terrestres',
    'att_tiendas',
    'att_actividades',
    'att_reuniones',
    'att_rutas',
    'att_pois',
    'att_day_plans',
    'att_day_notes',
  ] as const;
  for (const table of level1Tables) {
    const r = await supabase.from(table)
      .update({ deleted_at: deletedAt } as never)
      .eq('viaje_id', viajeId)
      .is('deleted_at', null);
    if (r.error) throw r.error;
  }
  // att_pins: sin type — la migración fase 19-0 agrega la columna pero types
  // no la refleja porque no la usa ningún componente. Cast a unknown para
  // aplicar el soft delete uniforme (pattern preservado desde F19-0).
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
    // Soft delete: cascada explícita a hijos, nietos y bisnietos primero, luego padre.
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
