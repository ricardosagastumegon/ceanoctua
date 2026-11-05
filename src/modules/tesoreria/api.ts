// Tesoreria: la bandeja del otro lado.
//
// Esto NO es un modulo de combustible aunque nazca con el. Es la bandeja de
// quien recibe: hoy le llegan solicitudes de vale y solicitudes de pago
// firmadas; cuando se enchufe caja chica le llegaran tambien vales de dinero
// y liquidaciones. Por eso vive aparte.
//
// POR QUE LEE `envios` Y NO LAS TABLAS DE ORIGEN
//
// Porque RLS concede por tabla, no por fila enviada. Darle lectura sobre
// `pagos` para que vea la SP que se le mando seria darle TODOS los pagos. El
// envio trae un `snapshot`: una copia congelada de lo que necesita ver. Es la
// regla que fijo la usuaria el 5 nov 2026 --cada usuario es independiente, lo
// unico que cruza es lo que alguien manda a proposito.

import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database';

export type Envio = Database['public']['Tables']['envios']['Row'];
export type EnvioInsert = Database['public']['Tables']['envios']['Insert'];

export const ENVIOS_KEY = ['envios'];

export type DocTipo =
  | 'comb_solicitud'
  | 'comb_reporte'
  | 'pago'
  | 'cc_vale'
  | 'cc_liquidacion';

export const DOC_TIPO_LABEL: Record<DocTipo, string> = {
  comb_solicitud: 'Solicitud de vale',
  comb_reporte: 'Control de vales',
  pago: 'Solicitud de pago',
  cc_vale: 'Vale de caja chica',
  cc_liquidacion: 'Liquidación de caja chica',
};

/**
 * Lo que el remitente congela en el envio. Son los campos que la bandeja
 * pinta; ninguno se vuelve a leer de la tabla de origen.
 */
export type Snapshot = {
  serial?: string;
  fecha?: string;
  titulo?: string;
  monto?: number;
  moneda?: string;
  detalle?: string;
  /** Pares etiqueta/valor que la ficha muestra tal cual. */
  campos?: { etiqueta: string; valor: string }[];
};

export function leerSnapshot(e: Envio): Snapshot {
  const s = e.snapshot;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return {};
  return s as Snapshot;
}

export const enviosApi = {
  /** La bandeja: lo que me mandaron y todavia no resuelvo. */
  async pendientes(): Promise<Envio[]> {
    const { data, error } = await supabase
      .from('envios')
      .select('*')
      .eq('estado', 'enviado')
      .is('deleted_at', null)
      .order('enviado_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  /** El historial, para no perder de vista lo ya resuelto. */
  async resueltos(limite = 50): Promise<Envio[]> {
    const { data, error } = await supabase
      .from('envios')
      .select('*')
      .neq('estado', 'enviado')
      .is('deleted_at', null)
      .order('resuelto_at', { ascending: false })
      .limit(limite);
    if (error) throw error;
    return data ?? [];
  },

  /** Los de un documento concreto, para saber si ya se mando. */
  async porDocumento(docTipo: DocTipo, docId: string): Promise<Envio[]> {
    const { data, error } = await supabase
      .from('envios')
      .select('*')
      .eq('doc_tipo', docTipo)
      .eq('doc_id', docId)
      .is('deleted_at', null)
      .order('enviado_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async enviar(input: {
    destinatarioId: string;
    docTipo: DocTipo;
    docId: string;
    snapshot: Snapshot;
    nota?: string | null;
  }): Promise<Envio> {
    const { data, error } = await supabase
      .from('envios')
      .insert({
        destinatario_id: input.destinatarioId,
        doc_tipo: input.docTipo,
        doc_id: input.docId,
        snapshot: input.snapshot as unknown as Json,
        nota: input.nota ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Aceptar NO es un update: es una funcion `security definer`. El
   * destinatario no tiene permiso de escritura sobre `envios` --ni sobre
   * ninguna tabla de negocio-- y la funcion es lo unico que puede ejecutar.
   * Ella corre ademas la cascada que corresponda al tipo de documento.
   */
  async aceptar(envioId: string, datos: Record<string, unknown>, nota?: string): Promise<Envio> {
    const { data, error } = await supabase.rpc('envio_aceptar', {
      p_envio: envioId,
      p_datos: datos as unknown as Json,
      p_nota: nota ?? null,
    });
    if (error) throw error;
    return data as unknown as Envio;
  },

  async rechazar(envioId: string, nota: string): Promise<Envio> {
    const { data, error } = await supabase.rpc('envio_rechazar', {
      p_envio: envioId,
      p_nota: nota,
    });
    if (error) throw error;
    return data as unknown as Envio;
  },

  /** Retirar un envio que se mando por error. Borrado suave. */
  async retirar(envioId: string): Promise<void> {
    const { error } = await supabase
      .from('envios')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', envioId);
    if (error) throw error;
  },

  async marcarPagado(pagoId: string): Promise<void> {
    const { error } = await supabase.rpc('pago_marcar_pagado', { p_pago: pagoId });
    if (error) throw error;
  },
};
