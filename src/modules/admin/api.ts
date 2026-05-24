import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

// Entidades --------------------------------------------------------------
export type Entidad = Database['public']['Tables']['entidades']['Row'];
export type EntidadInsert = Database['public']['Tables']['entidades']['Insert'];
export type EntidadUpdate = Database['public']['Tables']['entidades']['Update'];

export const entidadesApi = {
  async list(): Promise<Entidad[]> {
    const { data, error } = await supabase.from('entidades').select('*').order('nombre');
    if (error) throw error;
    return data ?? [];
  },
  async create(input: EntidadInsert): Promise<Entidad> {
    const { data, error } = await supabase.from('entidades').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: EntidadUpdate): Promise<Entidad> {
    const { data, error } = await supabase.from('entidades').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('entidades').delete().eq('id', id);
    if (error) throw error;
  },
};

// Autorizadores ----------------------------------------------------------
export type Autorizador = Database['public']['Tables']['autorizadores']['Row'];
export type AutorizadorInsert = Database['public']['Tables']['autorizadores']['Insert'];
export type AutorizadorUpdate = Database['public']['Tables']['autorizadores']['Update'];

export const autorizadoresApi = {
  async list(): Promise<Autorizador[]> {
    const { data, error } = await supabase.from('autorizadores').select('*').order('nombre');
    if (error) throw error;
    return data ?? [];
  },
  async create(input: AutorizadorInsert): Promise<Autorizador> {
    const { data, error } = await supabase.from('autorizadores').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AutorizadorUpdate): Promise<Autorizador> {
    const { data, error } = await supabase.from('autorizadores').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('autorizadores').delete().eq('id', id);
    if (error) throw error;
  },
};

// Empleados --------------------------------------------------------------
export type Empleado = Database['public']['Tables']['empleados']['Row'];
export type EmpleadoInsert = Database['public']['Tables']['empleados']['Insert'];
export type EmpleadoUpdate = Database['public']['Tables']['empleados']['Update'];

export const empleadosApi = {
  async list(): Promise<Empleado[]> {
    const { data, error } = await supabase.from('empleados').select('*').order('nombre');
    if (error) throw error;
    return data ?? [];
  },
  async create(input: EmpleadoInsert): Promise<Empleado> {
    const { data, error } = await supabase.from('empleados').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: EmpleadoUpdate): Promise<Empleado> {
    const { data, error } = await supabase.from('empleados').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('empleados').delete().eq('id', id);
    if (error) throw error;
  },
};

// Tipos de pago ----------------------------------------------------------
export type TipoPago = Database['public']['Tables']['tipos_pago']['Row'];
export type TipoPagoInsert = Database['public']['Tables']['tipos_pago']['Insert'];
export type TipoPagoUpdate = Database['public']['Tables']['tipos_pago']['Update'];

export const tiposPagoApi = {
  async list(): Promise<TipoPago[]> {
    const { data, error } = await supabase.from('tipos_pago').select('*').order('tipo');
    if (error) throw error;
    return data ?? [];
  },
  async create(input: TipoPagoInsert): Promise<TipoPago> {
    const { data, error } = await supabase.from('tipos_pago').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: TipoPagoUpdate): Promise<TipoPago> {
    const { data, error } = await supabase.from('tipos_pago').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('tipos_pago').delete().eq('id', id);
    if (error) throw error;
  },
};

// Proveedores ------------------------------------------------------------
export type Proveedor = Database['public']['Tables']['proveedores']['Row'];
export type ProveedorInsert = Database['public']['Tables']['proveedores']['Insert'];
export type ProveedorUpdate = Database['public']['Tables']['proveedores']['Update'];

export const proveedoresApi = {
  async list(): Promise<Proveedor[]> {
    const { data, error } = await supabase.from('proveedores').select('*').order('nombre');
    if (error) throw error;
    return data ?? [];
  },
  async create(input: ProveedorInsert): Promise<Proveedor> {
    const { data, error } = await supabase.from('proveedores').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: ProveedorUpdate): Promise<Proveedor> {
    const { data, error } = await supabase.from('proveedores').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('proveedores').delete().eq('id', id);
    if (error) throw error;
  },
};

// Tarjetas de crédito ----------------------------------------------------
export type Tarjeta = Database['public']['Tables']['tarjetas_credito']['Row'];
export type TarjetaInsert = Database['public']['Tables']['tarjetas_credito']['Insert'];
export type TarjetaUpdate = Database['public']['Tables']['tarjetas_credito']['Update'];

export const tarjetasApi = {
  async list(): Promise<Tarjeta[]> {
    const { data, error } = await supabase
      .from('tarjetas_credito')
      .select('*')
      .order('tipo')
      .order('tc_id');
    if (error) throw error;
    return data ?? [];
  },
  async create(input: TarjetaInsert): Promise<Tarjeta> {
    const { data, error } = await supabase
      .from('tarjetas_credito')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: TarjetaUpdate): Promise<Tarjeta> {
    const { data, error } = await supabase
      .from('tarjetas_credito')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('tarjetas_credito').delete().eq('id', id);
    if (error) throw error;
  },
};
