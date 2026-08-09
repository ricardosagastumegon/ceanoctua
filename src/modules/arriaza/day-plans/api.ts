import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttDayPlan = Database['public']['Tables']['att_day_plans']['Row'];
export type AttDayPlanInsert = Database['public']['Tables']['att_day_plans']['Insert'];
export type AttDayPlanUpdate = Database['public']['Tables']['att_day_plans']['Update'];

export type AttDayPlanRow = Database['public']['Tables']['att_day_plan_rows']['Row'];
export type AttDayPlanRowInsert = Database['public']['Tables']['att_day_plan_rows']['Insert'];
export type AttDayPlanRowUpdate = Database['public']['Tables']['att_day_plan_rows']['Update'];

// Cascade soft delete: al borrar un day_plan, propagar a sus rows.
async function cascadeSoftDeleteDayPlan(dayPlanId: string, deletedAt: string): Promise<void> {
  const r = await supabase
    .from('att_day_plan_rows')
    .update({ deleted_at: deletedAt })
    .eq('day_plan_id', dayPlanId)
    .is('deleted_at', null);
  if (r.error) throw r.error;
}

export const attDayPlansApi: CrudApi<AttDayPlan, AttDayPlanInsert, AttDayPlanUpdate> & {
  listByViaje(viajeId: string): Promise<AttDayPlan[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_day_plans').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_day_plans').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('fecha', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_day_plans').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_day_plans').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const now = new Date().toISOString();
    await cascadeSoftDeleteDayPlan(id, now);
    const { error } = await supabase.from('att_day_plans')
      .update({ deleted_at: now }).eq('id', id);
    if (error) throw error;
  },
};

export const attDayPlanRowsApi = {
  async listByDayPlan(dayPlanId: string): Promise<AttDayPlanRow[]> {
    const { data, error } = await supabase
      .from('att_day_plan_rows')
      .select('*')
      .eq('day_plan_id', dayPlanId)
      .is('deleted_at', null)
      .order('horario', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string): Promise<AttDayPlanRow[]> {
    // JOIN implícito via att_day_plans.viaje_id.
    const { data, error } = await supabase
      .from('att_day_plan_rows')
      .select('*, att_day_plans!inner(viaje_id)')
      .eq('att_day_plans.viaje_id', viajeId)
      .is('deleted_at', null)
      .is('att_day_plans.deleted_at', null);
    if (error) throw error;
    // Strip la relación embebida para no romper el tipo.
    return (data ?? []).map(({ att_day_plans: _drop, ...rest }) => rest as AttDayPlanRow);
  },
  async create(input: AttDayPlanRowInsert): Promise<AttDayPlanRow> {
    const { data, error } = await supabase
      .from('att_day_plan_rows').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AttDayPlanRowUpdate): Promise<AttDayPlanRow> {
    const { data, error } = await supabase
      .from('att_day_plan_rows').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('att_day_plan_rows')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
