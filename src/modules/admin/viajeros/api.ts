// Documentos de viaje: pasaportes y visas de quien viaja.
//
// Cuelgan de la persona que ya existe --Personal JD o Invitados--, con el
// mismo patrón de «uno de los dos» que los participantes del viaje. La API
// trabaja con esa pareja como una sola cosa, `Duenio`, para no repetir el
// condicional en cada llamada.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Pasaporte = Database['public']['Tables']['viajero_pasaportes']['Row'];
export type PasaporteInsert = Database['public']['Tables']['viajero_pasaportes']['Insert'];
export type PasaporteUpdate = Database['public']['Tables']['viajero_pasaportes']['Update'];
export type Visa = Database['public']['Tables']['viajero_visas']['Row'];
export type VisaInsert = Database['public']['Tables']['viajero_visas']['Insert'];
export type VisaUpdate = Database['public']['Tables']['viajero_visas']['Update'];
export type Afiliacion = Database['public']['Tables']['viajero_afiliaciones']['Row'];
export type AfiliacionInsert = Database['public']['Tables']['viajero_afiliaciones']['Insert'];
export type AfiliacionUpdate = Database['public']['Tables']['viajero_afiliaciones']['Update'];

/** De quién es el documento: una persona de Personal JD o un invitado. */
export type Duenio = { tipo: 'persona' | 'invitado'; id: string };

export function columnaDe(d: Duenio): 'persona_id' | 'invitado_id' {
  return d.tipo === 'persona' ? 'persona_id' : 'invitado_id';
}

export function duenioDe(fila: { persona_id: string | null; invitado_id: string | null }): Duenio {
  return fila.persona_id
    ? { tipo: 'persona', id: fila.persona_id }
    : { tipo: 'invitado', id: fila.invitado_id as string };
}

export const viajerosApi = {
  async pasaportes(): Promise<Pasaporte[]> {
    const { data, error } = await supabase
      .from('viajero_pasaportes')
      .select('*')
      .is('deleted_at', null)
      .order('vencimiento', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },

  async visas(): Promise<Visa[]> {
    const { data, error } = await supabase
      .from('viajero_visas')
      .select('*')
      .is('deleted_at', null)
      .order('vencimiento', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },

  async afiliaciones(): Promise<Afiliacion[]> {
    const { data, error } = await supabase
      .from('viajero_afiliaciones')
      .select('*')
      .is('deleted_at', null)
      .order('programa');
    if (error) throw error;
    return data ?? [];
  },

  async crearAfiliacion(
    duenio: Duenio,
    input: Omit<AfiliacionInsert, 'persona_id' | 'invitado_id'>,
  ) {
    const { error } = await supabase
      .from('viajero_afiliaciones')
      .insert({ ...input, [columnaDe(duenio)]: duenio.id });
    if (error) throw error;
  },

  async actualizarAfiliacion(id: string, patch: AfiliacionUpdate) {
    const { error } = await supabase.from('viajero_afiliaciones').update(patch).eq('id', id);
    if (error) throw error;
  },

  async borrarAfiliacion(id: string) {
    const { error } = await supabase
      .from('viajero_afiliaciones')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async crearPasaporte(duenio: Duenio, input: Omit<PasaporteInsert, 'persona_id' | 'invitado_id'>) {
    const { error } = await supabase
      .from('viajero_pasaportes')
      .insert({ ...input, [columnaDe(duenio)]: duenio.id });
    if (error) throw error;
  },

  async actualizarPasaporte(id: string, patch: PasaporteUpdate) {
    const { error } = await supabase.from('viajero_pasaportes').update(patch).eq('id', id);
    if (error) throw error;
  },

  async crearVisa(duenio: Duenio, input: Omit<VisaInsert, 'persona_id' | 'invitado_id'>) {
    const { error } = await supabase
      .from('viajero_visas')
      .insert({ ...input, [columnaDe(duenio)]: duenio.id });
    if (error) throw error;
  },

  async actualizarVisa(id: string, patch: VisaUpdate) {
    const { error } = await supabase.from('viajero_visas').update(patch).eq('id', id);
    if (error) throw error;
  },

  /**
   * Borrado suave, como todo documento del proyecto: un pasaporte vencido
   * sigue explicando con qué se viajó en 2024.
   */
  async borrarPasaporte(id: string) {
    const { error } = await supabase
      .from('viajero_pasaportes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async borrarVisa(id: string) {
    const { error } = await supabase
      .from('viajero_visas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  /** El escaneo del documento, en el bucket que ya usa T&T. */
  async subirImagen(carpeta: 'pasaportes' | 'visas', id: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'pdf';
    const path = `viajeros/${carpeta}/${id}.${Date.now()}.${ext}`;
    const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
    if (up.error) throw up.error;
    const tabla = carpeta === 'pasaportes' ? 'viajero_pasaportes' : 'viajero_visas';
    const { error } = await supabase.from(tabla).update({ imagen_path: path }).eq('id', id);
    if (error) throw error;
    return path;
  },
};
