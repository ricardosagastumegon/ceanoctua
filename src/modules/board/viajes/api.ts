import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Viaje = Database['public']['Tables']['viajes']['Row'];
export type ViajeInsert = Database['public']['Tables']['viajes']['Insert'];
export type ViajeUpdate = Database['public']['Tables']['viajes']['Update'];
export type ChecklistItem = Database['public']['Tables']['viaje_checklist']['Row'];

export const DEFAULT_CHECKLIST = [
  'Vuelo',
  'Hotel',
  'Traslados',
  'Restaurantes',
  'Itinerario',
  'Seguro',
];

export const viajesApi = {
  async listByMiembro(miembroId: string): Promise<Viaje[]> {
    const { data, error } = await supabase
      .from('viajes')
      .select('*')
      .eq('miembro_id', miembroId)
      .order('fecha_ini', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async listAll(): Promise<Viaje[]> {
    const { data, error } = await supabase
      .from('viajes')
      .select('*')
      .order('fecha_ini', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: ViajeInsert): Promise<Viaje> {
    const { data, error } = await supabase.from('viajes').insert(input).select('*').single();
    if (error) throw error;
    // Auto-generate the 6 default checklist items
    const items = DEFAULT_CHECKLIST.map((item, i) => ({
      viaje_id: data.id,
      item,
      orden: i,
      done: false,
    }));
    const { error: chkErr } = await supabase.from('viaje_checklist').insert(items);
    if (chkErr) throw chkErr;
    return data;
  },
  async update(id: string, patch: ViajeUpdate): Promise<Viaje> {
    const { data, error } = await supabase.from('viajes').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('viajes').delete().eq('id', id);
    if (error) throw error;
  },

  // Checklist sub-API
  async listChecklist(viajeId: string): Promise<ChecklistItem[]> {
    const { data, error } = await supabase
      .from('viaje_checklist')
      .select('*')
      .eq('viaje_id', viajeId)
      .order('orden', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async toggleChecklistItem(id: string, done: boolean): Promise<void> {
    const { error } = await supabase.from('viaje_checklist').update({ done }).eq('id', id);
    if (error) throw error;
  },
  async addChecklistItem(viajeId: string, item: string): Promise<ChecklistItem> {
    const { data, error } = await supabase
      .from('viaje_checklist')
      .insert({ viaje_id: viajeId, item, done: false })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async removeChecklistItem(id: string): Promise<void> {
    const { error } = await supabase.from('viaje_checklist').delete().eq('id', id);
    if (error) throw error;
  },
};
