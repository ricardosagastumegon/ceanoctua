import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Perfil = Database['public']['Tables']['perfiles']['Row'];
export type PerfilInsert = Database['public']['Tables']['perfiles']['Insert'];
export type PerfilUpdate = Database['public']['Tables']['perfiles']['Update'];
export type Vehiculo = Database['public']['Tables']['perfil_vehiculos']['Row'];
export type Familiar = Database['public']['Tables']['perfil_familia']['Row'];
export type FechaImportante = Database['public']['Tables']['perfil_fechas']['Row'];

export type PerfilFull = {
  perfil: Perfil | null;
  vehiculos: Vehiculo[];
  familia: Familiar[];
  fechas: FechaImportante[];
};

export const perfilApi = {
  async getByMiembro(miembroId: string): Promise<PerfilFull> {
    const { data: perfilRow, error: pErr } = await supabase
      .from('perfiles')
      .select('*')
      .eq('miembro_id', miembroId)
      .maybeSingle();
    if (pErr) throw pErr;

    if (!perfilRow) {
      return { perfil: null, vehiculos: [], familia: [], fechas: [] };
    }

    const [veh, fam, fec] = await Promise.all([
      supabase.from('perfil_vehiculos').select('*').eq('perfil_id', perfilRow.id).order('created_at'),
      supabase.from('perfil_familia').select('*').eq('perfil_id', perfilRow.id).order('created_at'),
      supabase.from('perfil_fechas').select('*').eq('perfil_id', perfilRow.id).order('fecha'),
    ]);
    if (veh.error) throw veh.error;
    if (fam.error) throw fam.error;
    if (fec.error) throw fec.error;

    return {
      perfil: perfilRow,
      vehiculos: veh.data ?? [],
      familia: fam.data ?? [],
      fechas: fec.data ?? [],
    };
  },

  async upsertPerfil(miembroId: string, patch: Omit<PerfilInsert, 'miembro_id' | 'id'>): Promise<Perfil> {
    const existing = await supabase.from('perfiles').select('id').eq('miembro_id', miembroId).maybeSingle();
    if (existing.error) throw existing.error;

    if (existing.data) {
      const { data, error } = await supabase
        .from('perfiles')
        .update(patch as PerfilUpdate)
        .eq('id', existing.data.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase
      .from('perfiles')
      .insert({ ...patch, miembro_id: miembroId })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // Vehiculos sub-table
  async addVehiculo(perfilId: string, input: { modelo: string | null; placa: string | null }): Promise<Vehiculo> {
    const { data, error } = await supabase
      .from('perfil_vehiculos')
      .insert({ perfil_id: perfilId, modelo: input.modelo, placa: input.placa })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async updateVehiculo(id: string, patch: { modelo?: string | null; placa?: string | null }): Promise<void> {
    const { error } = await supabase.from('perfil_vehiculos').update(patch).eq('id', id);
    if (error) throw error;
  },
  async removeVehiculo(id: string): Promise<void> {
    const { error } = await supabase.from('perfil_vehiculos').delete().eq('id', id);
    if (error) throw error;
  },

  // Familia sub-table
  async addFamiliar(perfilId: string, input: { nombre: string; relacion: string | null; fecha_nac: string | null }): Promise<Familiar> {
    const { data, error } = await supabase
      .from('perfil_familia')
      .insert({ perfil_id: perfilId, ...input })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async updateFamiliar(id: string, patch: { nombre?: string; relacion?: string | null; fecha_nac?: string | null }): Promise<void> {
    const { error } = await supabase.from('perfil_familia').update(patch).eq('id', id);
    if (error) throw error;
  },
  async removeFamiliar(id: string): Promise<void> {
    const { error } = await supabase.from('perfil_familia').delete().eq('id', id);
    if (error) throw error;
  },

  // Fechas sub-table
  async addFecha(perfilId: string, input: { titulo: string; fecha: string }): Promise<FechaImportante> {
    const { data, error } = await supabase
      .from('perfil_fechas')
      .insert({ perfil_id: perfilId, ...input })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async updateFecha(id: string, patch: { titulo?: string; fecha?: string }): Promise<void> {
    const { error } = await supabase.from('perfil_fechas').update(patch).eq('id', id);
    if (error) throw error;
  },
  async removeFecha(id: string): Promise<void> {
    const { error } = await supabase.from('perfil_fechas').delete().eq('id', id);
    if (error) throw error;
  },
};
