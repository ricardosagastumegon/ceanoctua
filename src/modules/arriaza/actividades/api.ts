import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttActividad = Database['public']['Tables']['att_actividades']['Row'];
export type AttActividadInsert = Database['public']['Tables']['att_actividades']['Insert'];
export type AttActividadUpdate = Database['public']['Tables']['att_actividades']['Update'];

/**
 * Cascade soft delete: al borrar una actividad, propaga `deleted_at` a sus
 * participantes. El `on delete cascade` físico NO se dispara con un UPDATE,
 * así que hay que iterar a mano (patrón establecido en viajes/api.ts).
 */
async function cascadeSoftDeleteActividad(actividadId: string, deletedAt: string): Promise<void> {
  const { error } = await supabase
    .from('att_actividad_entradas')
    .update({ deleted_at: deletedAt })
    .eq('actividad_id', actividadId)
    .is('deleted_at', null);
  if (error) throw error;
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
