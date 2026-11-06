// Control de combustible de vehiculos.
//
// La cadena completa vive en una sola fila de `comb_solicitudes`, que se va
// llenando: solicitud de vale -> vale de la gasolinera -> recibo de despacho
// -> factura -> contraseña. Los cuatro documentos describen el mismo consumo.
//
// Lo que cruza a otro usuario --la solicitud que va al Tesorero, la SP que
// vuelve firmada-- no se escribe aqui: pasa por `envios`, que es la unica
// puerta entre espacios. Ver `src/modules/tesoreria/api.ts`.

import { supabase } from '@/lib/supabase';
import { stripServerGenerated } from '@/lib/createCrudHooks';
import type { Database } from '@/types/database';

export type Solicitud = Database['public']['Tables']['comb_solicitudes']['Row'];
export type SolicitudInsert = Database['public']['Tables']['comb_solicitudes']['Insert'];
export type SolicitudUpdate = Database['public']['Tables']['comb_solicitudes']['Update'];

export type Reporte = Database['public']['Tables']['comb_reportes']['Row'];
export type ReporteInsert = Database['public']['Tables']['comb_reportes']['Insert'];
export type ReporteUpdate = Database['public']['Tables']['comb_reportes']['Update'];

export type Responsable = Database['public']['Tables']['comb_responsables']['Row'];
export type ResponsableInsert = Database['public']['Tables']['comb_responsables']['Insert'];
export type ResponsableUpdate = Database['public']['Tables']['comb_responsables']['Update'];

/**
 * Los estados por los que pasa una solicitud, en orden. El indice sirve para
 * saber si ya paso por un punto sin enumerar casos.
 */
export const ESTADOS = [
  'borrador',
  'enviada_tesorero',
  'vale_emitido',
  'despachada',
  'documentada',
  'en_reporte',
  'en_tesoreria',
  'pagada',
] as const;

export const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  enviada_tesorero: 'Con el tesorero',
  vale_emitido: 'Vale emitido',
  despachada: 'Despachada',
  documentada: 'Documentada',
  en_reporte: 'En control de vales',
  en_tesoreria: 'En tesorería',
  pagada: 'Pagada',
  anulada: 'Anulada',
};

/** Color del distintivo de estado. Sigue la paleta del proyecto. */
export const ESTADO_COLOR: Record<string, string> = {
  borrador: 'bg-sand-l text-dark-2',
  enviada_tesorero: 'bg-gold/20 text-dark',
  vale_emitido: 'bg-teal/15 text-teal',
  despachada: 'bg-teal/15 text-teal',
  documentada: 'bg-purple/15 text-purple',
  en_reporte: 'bg-purple/15 text-purple',
  en_tesoreria: 'bg-gold/25 text-dark',
  pagada: 'bg-teal text-white',
  anulada: 'bg-rust/15 text-rust',
};

export const REPORTE_ESTADO_LABEL: Record<string, string> = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  enviado_a_pagos: 'Enviado a Pagos',
  en_tesoreria: 'En tesorería',
  pagado: 'Pagado',
};

export function estadoAlcanzado(estado: string, hito: (typeof ESTADOS)[number]): boolean {
  const i = ESTADOS.indexOf(estado as (typeof ESTADOS)[number]);
  return i >= 0 && i >= ESTADOS.indexOf(hito);
}

/**
 * Lo que pone el servidor y el cliente no debe mandar. `serial` sobre todo:
 * el correlativo lo genera un trigger contra una secuencia, porque el cliente
 * no tiene forma de garantizar que no colisione (invariante 5).
 */
const SERVIDOR = ['id', 'serial', 'created_at', 'updated_at'] as const;

export const solicitudesApi = {
  async list(): Promise<Solicitud[]> {
    const { data, error } = await supabase
      .from('comb_solicitudes')
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Las de un control de vales, en el orden en que se imprimen. */
  async delReporte(reporteId: string): Promise<Solicitud[]> {
    const { data, error } = await supabase
      .from('comb_solicitudes')
      .select('*')
      .eq('reporte_id', reporteId)
      .is('deleted_at', null)
      .order('fecha', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: SolicitudInsert): Promise<Solicitud> {
    const { data, error } = await supabase
      .from('comb_solicitudes')
      .insert(stripServerGenerated(input, SERVIDOR) as SolicitudInsert)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: SolicitudUpdate): Promise<Solicitud> {
    const { data, error } = await supabase
      .from('comb_solicitudes')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Borrado suave, y solo para el administrador.
   *
   * Va por RPC y no por un update desde aqui porque hay dos cosas que el
   * cliente no puede garantizar: que se retire el envio que este en la
   * bandeja del Tesorero --un envio sin documento detras no se puede
   * resolver-- y que no se le quite un renglon a un control ya cerrado, cuyo
   * total ya viajo a Pagos.
   */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.rpc('comb_borrar_solicitud', { p_solicitud: id });
    if (error) throw error;
  },

  /**
   * Saca o devuelve un vale al control de su quincena.
   *
   * La marca es lo que distingue «todavia no le toco» de «la saque yo»: sin
   * ella, el automatismo que mete los vales en su control volveria a meter
   * cada cosa que se saca a mano.
   */
  async excluirDelControl(id: string, excluir: boolean): Promise<void> {
    const { error } = await supabase
      .from('comb_solicitudes')
      .update({ excluir_del_control: excluir, ...(excluir ? { reporte_id: null } : {}) })
      .eq('id', id);
    if (error) throw error;
  },
};

export const reportesApi = {
  async list(): Promise<Reporte[]> {
    const { data, error } = await supabase
      .from('comb_reportes')
      .select('*')
      .is('deleted_at', null)
      .order('periodo_ini', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: ReporteInsert): Promise<Reporte> {
    const { data, error } = await supabase
      .from('comb_reportes')
      .insert(stripServerGenerated(input, SERVIDOR) as ReporteInsert)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: ReporteUpdate): Promise<Reporte> {
    const { data, error } = await supabase
      .from('comb_reportes')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Borrado suave. Despues suelta sus vales, en ese orden: con el control ya
   * marcado como borrado, el trigger que los reparte no se lo devuelve y
   * quedan libres para la quincena que les toque.
   */
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('comb_reportes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    const { error: e2 } = await supabase
      .from('comb_solicitudes')
      .update({ reporte_id: null })
      .eq('reporte_id', id)
      .is('deleted_at', null);
    if (e2) throw e2;
  },

  /**
   * Cerrar y enviar a Pagos NO son updates: son funciones en la base.
   *
   * El total se calcula en el servidor y se congela ahi. Si se calculara al
   * leer, el papel impreso y la pantalla podrian decir cosas distintas el dia
   * que alguien edite una solicitud vieja. Ademas la funcion se niega a cerrar
   * si falta algun monto, que es justo lo que no se ve a simple vista.
   */
  async cerrar(id: string): Promise<Reporte> {
    const { data, error } = await supabase.rpc('comb_cerrar_reporte', { p_reporte: id });
    if (error) throw error;
    return data as unknown as Reporte;
  },

  async enviarAPagos(id: string): Promise<void> {
    const { error } = await supabase.rpc('comb_enviar_a_pagos', { p_reporte: id });
    if (error) throw error;
  },

  /**
   * Mete o saca vales del control a mano. Solo mientras esta abierto.
   *
   * El caso normal no pasa por aqui: un vale entra en el control de su
   * quincena solo, por la fecha. Esto es la correccion --el vale que se
   * quedo sin despacho y hay que pasar a la quincena siguiente.
   */
  async asignar(solicitudIds: string[], reporteId: string | null): Promise<void> {
    const { error } = await supabase
      .from('comb_solicitudes')
      .update({ reporte_id: reporteId, excluir_del_control: reporteId == null })
      .in('id', solicitudIds);
    if (error) throw error;
  },
};

export const responsablesApi = {
  async list(): Promise<Responsable[]> {
    const { data, error } = await supabase
      .from('comb_responsables')
      .select('*')
      .is('deleted_at', null)
      .order('orden', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: ResponsableInsert): Promise<Responsable> {
    const { data, error } = await supabase
      .from('comb_responsables')
      .insert(stripServerGenerated(input, ['id', 'created_at', 'updated_at']) as ResponsableInsert)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: ResponsableUpdate): Promise<Responsable> {
    const { data, error } = await supabase
      .from('comb_responsables')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('comb_responsables')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
