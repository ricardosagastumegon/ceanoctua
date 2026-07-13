import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttRestaurante = Database['public']['Tables']['att_restaurantes']['Row'];
export type AttRestauranteInsert = Database['public']['Tables']['att_restaurantes']['Insert'];
export type AttRestauranteUpdate = Database['public']['Tables']['att_restaurantes']['Update'];

// Cascade soft-delete: restaurante → diners + services + pay_records.
async function cascadeSoftDeleteRestaurante(restauranteId: string, deletedAt: string): Promise<void> {
  const rDin = await supabase.from('att_restaurant_diners')
    .update({ deleted_at: deletedAt }).eq('restaurante_id', restauranteId).is('deleted_at', null);
  if (rDin.error) throw rDin.error;
  const rSvc = await supabase.from('att_restaurant_services')
    .update({ deleted_at: deletedAt }).eq('restaurante_id', restauranteId).is('deleted_at', null);
  if (rSvc.error) throw rSvc.error;
  const rPay = await supabase.from('att_restaurant_pay_records')
    .update({ deleted_at: deletedAt }).eq('restaurante_id', restauranteId).is('deleted_at', null);
  if (rPay.error) throw rPay.error;
}

export const restaurantesApi = {
  async listByViaje(viajeId: string): Promise<AttRestaurante[]> {
    const { data, error } = await supabase
      .from('att_restaurantes')
      .select('*')
      .eq('viaje_id', viajeId)
      .is('deleted_at', null)
      .order('fecha', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: AttRestauranteInsert): Promise<AttRestaurante> {
    const { data, error } = await supabase.from('att_restaurantes').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AttRestauranteUpdate): Promise<AttRestaurante> {
    const { data, error } = await supabase.from('att_restaurantes').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    // Soft delete + cascada a hijos (diners + services + pay_records).
    // Invariante 6 · CLAUDE.md §4.
    const now = new Date().toISOString();
    await cascadeSoftDeleteRestaurante(id, now);
    const { error } = await supabase
      .from('att_restaurantes')
      .update({ deleted_at: now })
      .eq('id', id);
    if (error) throw error;
  },
};
