// Acceso a datos del módulo Aeronaves.
//
// El módulo está organizado en capas: la flota, y dentro de ella cada
// aeronave con lo suyo. La matrícula es la llave visible --va en la
// dirección, `/aeronaves/TG-OBI`-- porque es única, no cambia y se lee.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Aeronave = Database['public']['Tables']['avn_aeronaves']['Row'];
export type AeronaveInsert = Database['public']['Tables']['avn_aeronaves']['Insert'];
export type AeronaveUpdate = Database['public']['Tables']['avn_aeronaves']['Update'];

export type TipoCertificado = Database['public']['Tables']['avn_tipos_certificado']['Row'];

export type DocumentoRow = Database['public']['Tables']['avn_documentos']['Row'];
export type DocumentoInsert = Database['public']['Tables']['avn_documentos']['Insert'];
export type DocumentoUpdate = Database['public']['Tables']['avn_documentos']['Update'];

/** Un documento con el nombre de su tipo ya resuelto. */
export type Documento = DocumentoRow & { tipo_nombre: string };

const BUCKET = 'avn-documentos';

export const aeronavesApi = {
  async list(): Promise<Aeronave[]> {
    const { data, error } = await supabase
      .from('avn_aeronaves')
      .select('*')
      .is('deleted_at', null)
      .order('orden')
      .order('matricula');
    if (error) throw error;
    return data ?? [];
  },

  async byMatricula(matricula: string): Promise<Aeronave | null> {
    const { data, error } = await supabase
      .from('avn_aeronaves')
      .select('*')
      .eq('matricula', matricula)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  async create(input: AeronaveInsert): Promise<Aeronave> {
    const { data, error } = await supabase
      .from('avn_aeronaves')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: AeronaveUpdate): Promise<Aeronave> {
    const { data, error } = await supabase
      .from('avn_aeronaves')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /** Borrado suave · regla 6 del proyecto. */
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('avn_aeronaves')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

export const tiposCertificadoApi = {
  async list(): Promise<TipoCertificado[]> {
    const { data, error } = await supabase
      .from('avn_tipos_certificado')
      .select('*')
      .order('orden')
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  },
};

export const documentosApi = {
  async byAeronave(aeronaveId: string): Promise<Documento[]> {
    const { data, error } = await supabase
      .from('avn_documentos')
      .select('*, avn_tipos_certificado(nombre)')
      .eq('aeronave_id', aeronaveId)
      .is('deleted_at', null)
      .order('anio', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((d) => {
      const { avn_tipos_certificado: tipo, ...resto } = d as DocumentoRow & {
        avn_tipos_certificado: { nombre: string } | null;
      };
      return { ...resto, tipo_nombre: tipo?.nombre ?? '—' };
    });
  },

  async create(input: DocumentoInsert): Promise<DocumentoRow> {
    const { data, error } = await supabase
      .from('avn_documentos')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: DocumentoUpdate): Promise<DocumentoRow> {
    const { data, error } = await supabase
      .from('avn_documentos')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('avn_documentos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

/**
 * Sube el archivo del certificado.
 *
 * La ruta lleva matrícula, año y un sufijo aleatorio: así se puede hojear el
 * bucket y entender qué es cada cosa, y dos cargas del mismo certificado en
 * el mismo año no se pisan entre sí.
 */
export async function subirArchivo(
  matricula: string,
  anio: number,
  file: File,
): Promise<{ path: string; nombre: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const limpio = file.name
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'documento';
  const path = `${matricula}/${anio}/${limpio}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return { path, nombre: file.name };
}

/**
 * Abre el archivo. El bucket es privado, así que hace falta una URL firmada;
 * dura una hora, que es de sobra para verlo o descargarlo.
 */
export async function urlArchivo(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function borrarArchivo(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
