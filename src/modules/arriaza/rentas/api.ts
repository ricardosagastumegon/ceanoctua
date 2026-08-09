import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttRenta = Database['public']['Tables']['att_rentas']['Row'];
export type AttRentaInsert = Database['public']['Tables']['att_rentas']['Insert'];
export type AttRentaUpdate = Database['public']['Tables']['att_rentas']['Update'];

export const attRentasApi: CrudApi<AttRenta, AttRentaInsert, AttRentaUpdate> & {
  listByViaje(viajeId: string): Promise<AttRenta[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_rentas').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_rentas').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_rentas').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_rentas').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_rentas')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

// ttRentaTotal · tarifa × dias + deposito + Σ extras.
export function rentaTotal(v: AttRenta): number {
  const dias = Number(v.dias ?? 0);
  const tarifa = Number(v.tarifa ?? 0);
  const deposito = Number(v.deposito ?? 0);
  const extrasArr = Array.isArray(v.extras) ? (v.extras as { amount?: number | string }[]) : [];
  const extrasSum = extrasArr.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  return tarifa * dias + deposito + extrasSum;
}
