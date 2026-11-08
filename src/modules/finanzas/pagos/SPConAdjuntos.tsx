import { useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { armarPdfConAdjuntos, type ArchivoAdjunto } from '@/lib/pdf-hojas';
import { describeError } from '@/modules/admin/hooks';
import type { Pago } from './api';
import { entidadesDelOrigen } from './ExpedienteDeLaSP';

/**
 * La solicitud de pago y su expediente, en UN solo PDF.
 *
 * «Cuando una SP vuelva a mi ya firmada, debe de poder imprimirse llevando la
 * firma [...] y con los documentos adjuntos tanto vale como factura».
 *
 * `window.print()` no sabe hacerlo: imprime lo que hay en pantalla y un PDF
 * ajeno no se puede meter dentro. Pero la maquina ya existia en el proyecto
 * --`lib/pdf-hojas`, que nacio para las liquidaciones de T&T-- y hace
 * exactamente esto: captura la hoja, le pega detras cada adjunto (un PDF
 * aporta todas sus paginas, una imagen se vuelve una pagina) y devuelve un
 * archivo.
 *
 * LA FIRMA va en la hoja, no aqui: el imprimible estampa la imagen de quien
 * firmo, que cada quien sube desde su tablero. Si no la ha subido, la linea
 * sale en blanco --como el papel antes de firmarlo-- y no como un error.
 */

type Origen = { tipo: string; id: string };

/**
 * Todo lo que respalda la solicitud: lo suyo y lo que trae de su origen.
 *
 * `origenes` se pasa cuando quien mira no puede averiguarlos --el Tesorero no
 * lee los avisos, los recibe congelados en el envio. Cuando no se pasa, se
 * resuelven aqui.
 */
export function useArchivosDelExpediente(pago: Pago, origenes?: Origen[]) {
  return useQuery<ArchivoAdjunto[], Error>({
    queryKey: ['expediente_archivos', pago.id, origenes?.map((o) => o.id).join(',') ?? ''],
    queryFn: async () => {
      const claves: Origen[] = [{ tipo: 'pago', id: pago.id }];

      // El mapa de origenes vive en UN solo sitio --`ENTIDAD_DEL_ORIGEN`, via
      // `entidadesDelOrigen`--. Antes estaba copiado aqui, y añadir un origen
      // exigia acordarse de los dos: el que se olvidara daba una SP que se
      // descarga sin la mitad de su respaldo y sin ningun error.
      const avisos = origenes ?? (
        await supabase
          .from('pagos_notificaciones')
          .select('origen_tipo, origen_id, pago_id, id')
          .or(`pago_id.eq.${pago.id},id.eq.${pago.origen_notificacion_id ?? pago.id}`)
      ).data ?? [];

      for (const n of avisos as { origen_tipo: string; origen_id: string | null }[]) {
        if (!n.origen_id) continue;
        claves.push(...(await entidadesDelOrigen(n.origen_tipo, n.origen_id)));
      }

      const archivos: ArchivoAdjunto[] = [];
      for (const c of claves) {
        const { data } = await supabase
          .from('documentos')
          .select('nombre, storage_path')
          .eq('entidad_tipo', c.tipo)
          .eq('entidad_id', c.id)
          .order('created_at');
        for (const d of data ?? []) {
          // Sin repetir: el mismo archivo puede llegar por dos caminos si una
          // solicitud cubre dos avisos del mismo origen.
          if (!archivos.some((a) => a.path === d.storage_path)) {
            archivos.push({ path: d.storage_path, titulo: d.nombre });
          }
        }
      }
      return archivos;
    },
  });
}

export function BotonSPConAdjuntos({
  pago,
  hoja,
  origenes,
}: {
  pago: Pago;
  hoja: RefObject<HTMLDivElement | null>;
  origenes?: Origen[];
}) {
  const toast = useToast();
  const archivosQ = useArchivosDelExpediente(pago, origenes);
  const [paso, setPaso] = useState<string | null>(null);

  const archivos = archivosQ.data ?? [];
  if (archivos.length === 0) return null;

  async function bajar() {
    if (!hoja.current) return;
    setPaso('Preparando…');
    try {
      const { blob, fallidos } = await armarPdfConAdjuntos(
        [hoja.current],
        'documentos',
        archivos,
        (p) => setPaso(p.paso),
      );
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(pago.serial ?? 'solicitud').replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);

      if (fallidos.length > 0) {
        // Se dice cual falto en vez de dejar creer que esta completo: un
        // adjunto perdido en silencio es peor que no tenerlo.
        toast.error(`No se pudo incluir: ${fallidos.join(', ')}. El resto sí bajó.`);
      } else {
        toast.success('Solicitud lista, con su expediente.');
      }
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setPaso(null);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void bajar()}
      disabled={paso !== null}
      className="rounded-md border border-teal/50 bg-teal-l px-3 py-1.5 text-xs font-semibold text-teal-d hover:opacity-90 disabled:opacity-60"
      title="Un solo PDF: la solicitud firmada y todo lo que la respalda"
    >
      {paso ?? `📎 Con expediente (${archivos.length})`}
    </button>
  );
}
