import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * La firma escaneada de cada quien, para estampar los documentos.
 *
 * Se sube una sola vez y queda en el bucket privado `documentos`. El sello
 * SIEMPRE usa la firma de quien de verdad apretó el botón --`firmada_por`--
 * y no la de a quién se le pidió: una firma escaneada es reusable, y así
 * nadie puede estampar la de otro.
 *
 * Las políticas de `usuarios` ya protegen esto: cada quien lee y escribe su
 * propia fila, y solo el admin lee las demás. Un usuario común que mire un
 * documento firmado por otro verá la línea en blanco, no su firma.
 */

export const estampaKey = (usuarioId: string | null | undefined) =>
  ['firma_estampa', usuarioId ?? ''] as const;

async function rutaFirma(usuarioId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('firma_path')
    .eq('id', usuarioId)
    .maybeSingle();
  if (error) throw error;
  return data?.firma_path ?? null;
}

/** El enlace temporal a la firma de alguien, o null si no tiene o no se puede ver. */
export function useEstampaDe(usuarioId: string | null | undefined) {
  return useQuery({
    queryKey: estampaKey(usuarioId),
    enabled: !!usuarioId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<string | null> => {
      try {
        const path = await rutaFirma(usuarioId as string);
        if (!path) return null;
        const { data, error } = await supabase.storage
          .from('documentos')
          .createSignedUrl(path, 3600);
        if (error) throw error;
        return data.signedUrl;
      } catch {
        // No poder ver la firma de otro no es un error que deba romper el
        // documento: simplemente sale la línea en blanco.
        return null;
      }
    },
  });
}

/** Subir o reemplazar la firma propia. */
export function useSubirMiFirma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const { data: sesion } = await supabase.auth.getUser();
      const uid = sesion.user?.id;
      if (!uid) throw new Error('No hay sesión.');

      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
      const path = `firmas/${uid}.${Date.now()}.${ext}`;
      const up = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
      if (up.error) throw up.error;

      const { error } = await supabase.from('usuarios').update({ firma_path: path }).eq('id', uid);
      if (error) throw error;
      return path;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['firma_estampa'] }),
  });
}

/** Si el usuario que entró ya subió su firma. */
export function useTengoFirma(usuarioId: string | null | undefined) {
  const q = useEstampaDe(usuarioId);
  return { url: q.data ?? null, cargando: q.isLoading };
}
