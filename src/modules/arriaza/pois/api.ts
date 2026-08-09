import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttPoi = Database['public']['Tables']['att_pois']['Row'];
export type AttPoiInsert = Database['public']['Tables']['att_pois']['Insert'];
export type AttPoiUpdate = Database['public']['Tables']['att_pois']['Update'];

export type PoiPunto = { nombre?: string; descripcion?: string };

export const attPoisApi: CrudApi<AttPoi, AttPoiInsert, AttPoiUpdate> & {
  listByViaje(viajeId: string): Promise<AttPoi[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_pois').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_pois').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_pois').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_pois').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_pois')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

export function poiTotal(_x: AttPoi): number {
  return 0;
}

export function readPoiPuntos(x: AttPoi): PoiPunto[] {
  return Array.isArray(x.puntos) ? (x.puntos as PoiPunto[]) : [];
}
