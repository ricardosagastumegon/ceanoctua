import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttTour = Database['public']['Tables']['att_tours']['Row'];
export type AttTourInsert = Database['public']['Tables']['att_tours']['Insert'];
export type AttTourUpdate = Database['public']['Tables']['att_tours']['Update'];

export const attToursApi: CrudApi<AttTour, AttTourInsert, AttTourUpdate> & {
  listByViaje(viajeId: string): Promise<AttTour[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_tours').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_tours').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_tours').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_tours').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_tours')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

// ttTourTotal · tarifa por persona × personas.
export function tourTotal(x: AttTour): number {
  return Number(x.tarifa ?? 0) * Number(x.personas ?? 0);
}
