import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttReunion = Database['public']['Tables']['att_reuniones']['Row'];
export type AttReunionInsert = Database['public']['Tables']['att_reuniones']['Insert'];
export type AttReunionUpdate = Database['public']['Tables']['att_reuniones']['Update'];

// Base CRUD estándar (soft delete ya limpia day_plan_rows.reunion_id vía on delete set null).
export const attReunionesApi: CrudApi<AttReunion, AttReunionInsert, AttReunionUpdate> & {
  listByViaje(viajeId: string): Promise<AttReunion[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_reuniones').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_reuniones').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('fecha', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_reuniones').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_reuniones').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_reuniones')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

export function reunionTotal(_x: AttReunion): number {
  return 0;
}

/**
 * Sincroniza una reunión al Itinerario del día:
 *   - Busca (o crea) el att_day_plan de esa fecha para el viaje.
 *   - Elimina cualquier row previa con reunion_id = X (limpieza si cambió fecha).
 *   - Inserta una row nueva con horario/itinerario derivados de la reunión.
 *
 * Paridad con ttSyncReunionToDayPlan del HTML. En el HTML corría en el
 * cliente; aquí hace lo mismo desde el hook onSuccess de create/update.
 */
export async function syncReunionToDayPlan(reunion: AttReunion): Promise<void> {
  // 1) Limpiar rows viejas que apunten a esta reunión (en cualquier fecha).
  const cleanup = await supabase
    .from('att_day_plan_rows')
    .update({ deleted_at: new Date().toISOString() })
    .eq('reunion_id', reunion.id)
    .is('deleted_at', null);
  if (cleanup.error) throw cleanup.error;

  // 2) Encontrar (o crear) el day_plan de esa fecha para el viaje.
  const existing = await supabase
    .from('att_day_plans')
    .select('id')
    .eq('viaje_id', reunion.viaje_id)
    .eq('fecha', reunion.fecha)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing.error) throw existing.error;

  let dayPlanId: string;
  if (existing.data) {
    dayPlanId = existing.data.id;
  } else {
    const created = await supabase
      .from('att_day_plans')
      .insert({ viaje_id: reunion.viaje_id, fecha: reunion.fecha })
      .select('id')
      .single();
    if (created.error) throw created.error;
    dayPlanId = created.data.id;
  }

  // 3) Insertar row nueva con la reunión.
  const label = reunion.cita + (reunion.asunto ? ` — ${reunion.asunto}` : '');
  const insert = await supabase.from('att_day_plan_rows').insert({
    day_plan_id: dayPlanId,
    horario: reunion.hora,
    itinerario: label,
    reunion_id: reunion.id,
    es_auto_reunion: true,
  });
  if (insert.error) throw insert.error;
}
