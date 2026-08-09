import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttTienda = Database['public']['Tables']['att_tiendas']['Row'];
export type AttTiendaInsert = Database['public']['Tables']['att_tiendas']['Insert'];
export type AttTiendaUpdate = Database['public']['Tables']['att_tiendas']['Update'];

export const attTiendasApi: CrudApi<AttTienda, AttTiendaInsert, AttTiendaUpdate> & {
  listByViaje(viajeId: string): Promise<AttTienda[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_tiendas').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_tiendas').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_tiendas').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_tiendas').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_tiendas')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

export function tiendaTotal(_x: AttTienda): number {
  return 0;
}
