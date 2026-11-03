import { supabase } from '@/lib/supabase';

/**
 * Abrir un archivo que alguien subió.
 *
 * Los buckets son privados, así que no hay una dirección fija que se pueda
 * poner en un enlace: hay que pedirle a Supabase una firmada, que caduca.
 *
 * Diez minutos alcanzan de sobra para mirarlo o imprimirlo, y si la pestaña
 * se queda abierta hasta mañana el enlace ya no sirve, que es lo que uno
 * quiere de un boarding pass o de una factura.
 */
const VIGENCIA_SEGUNDOS = 600;

export async function urlFirmada(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, VIGENCIA_SEGUNDOS);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Abre el archivo en otra pestaña.
 *
 * La pestaña se abre ANTES de pedir el enlace, aunque todavía no haya nada
 * que mostrar: si se abre después, el navegador ya no lo considera respuesta
 * a un clic y lo bloquea como ventana emergente.
 */
export async function abrirAdjunto(bucket: string, path: string): Promise<void> {
  const pestana = window.open('', '_blank');
  try {
    const url = await urlFirmada(bucket, path);
    if (pestana) {
      pestana.location.href = url;
    } else {
      // El navegador la bloqueó de todos modos: al menos que se pueda bajar.
      window.location.href = url;
    }
  } catch (e) {
    pestana?.close();
    throw e;
  }
}

/** El nombre con el que se subió, para mostrarlo sin la ruta interna. */
export function nombreDeArchivo(path: string | null | undefined): string {
  if (!path) return '';
  return path.split('/').pop() ?? path;
}
