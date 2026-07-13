import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

// Fase 18 · Catálogo Vehículos (flota de la empresa).
// Distinta de arriaza_autos (autos personales de LA).
//
// Ancla canonical:
//   * modules/cc-board/vales/api.ts — pattern soft delete (list filtra
//     deleted_at is null; remove hace UPDATE con deleted_at)
//   * modules/admin/api.ts § statusSpApi — pattern estructural del CRUD
//     de catálogos (list/create/update/remove).

export type Vehiculo = Database['public']['Tables']['vehiculos']['Row'];
export type VehiculoInsert = Database['public']['Tables']['vehiculos']['Insert'];
export type VehiculoUpdate = Database['public']['Tables']['vehiculos']['Update'];

export const vehiculosApi = {
  async list(): Promise<Vehiculo[]> {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('*')
      .is('deleted_at', null)
      .order('marca', { ascending: true })
      .order('placa', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: VehiculoInsert): Promise<Vehiculo> {
    const { data, error } = await supabase
      .from('vehiculos')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: VehiculoUpdate): Promise<Vehiculo> {
    const { data, error } = await supabase
      .from('vehiculos')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    // Soft delete: UPDATE deleted_at, no DELETE físico (invariante 6
    // de CLAUDE.md §4).
    const { error } = await supabase
      .from('vehiculos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
