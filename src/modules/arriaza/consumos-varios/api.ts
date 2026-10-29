// Consumos Varios de un viaje.
//
// Los gastos menudos que se reportan al final del viaje --propinas, taxis, un
// café, una farmacia-- registrados como UN total bajo un concepto, no uno por
// uno. Un viaje puede tener varios renglones: uno por persona o uno por
// tarjeta, porque el estado de cuenta los va a mostrar por separado.
//
// Ojo con `reintegro`: aquí significa lo mismo que en los demás servicios --
// dinero que VOLVIÓ, un cargo reversado por el banco-- y no la solicitud de
// reintegro a la empresa. Esa vive en Finanzas, porque resta del neto y
// dejaría la tarjeta en cero.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttConsumoVarios = Database['public']['Tables']['att_consumos_varios']['Row'];
export type AttConsumoVariosInsert = Database['public']['Tables']['att_consumos_varios']['Insert'];
export type AttConsumoVariosUpdate = Database['public']['Tables']['att_consumos_varios']['Update'];

export const attConsumosVariosApi: CrudApi<
  AttConsumoVarios,
  AttConsumoVariosInsert,
  AttConsumoVariosUpdate
> & {
  listByViaje(viajeId: string): Promise<AttConsumoVarios[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_consumos_varios').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_consumos_varios').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('fecha', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase
      .from('att_consumos_varios').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase
      .from('att_consumos_varios').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_consumos_varios')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

export async function cargarPorId(id: string): Promise<AttConsumoVarios | null> {
  const { data, error } = await supabase
    .from('att_consumos_varios').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  return data;
}

/** El reporte escaneado. Subir otro reemplaza el anterior. */
export async function subirReporteConsumo(id: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `consumos-varios/${id}/reporte.${Date.now()}.${ext}`;
  const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from('att_consumos_varios').update({ reporte_path: path }).eq('id', id);
  if (error) throw error;
  return path;
}

/**
 * Un enlace temporal para abrir el reporte adjunto.
 *
 * El bucket es privado, así que la ruta guardada no se puede abrir sola. Una
 * hora alcanza: el enlace se pide en el momento de hacer clic.
 */
export async function urlReporteConsumo(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('tt-documentos').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
