import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { descargar } from '@/lib/descargar';
import { urlArchivo } from './api';

export type Visor =
  /** Un certificado guardado, que se pide firmado al abrirlo. */
  | { tipo: 'archivo'; path: string; titulo: string; nombre: string | null }
  /** Un documento armado en el momento, que ya vive en memoria. */
  | { tipo: 'blob'; blob: Blob; titulo: string; nombre: string };

/**
 * Ver un documento sin salir de la aplicación.
 *
 * Antes el certificado se abría en otra pestaña, lo que sacaba al usuario de
 * la pantalla y en algunos navegadores lo descargaba de una vez. Ahora se ve
 * aquí dentro, y desde el visor del navegador se decide si imprimir o
 * guardar.
 *
 * **Por qué no hay botón de «Imprimir» propio:** el archivo vive en otro
 * dominio, así que el navegador no deja que esta página le ordene imprimir al
 * marco donde se muestra. El visor de PDF incorporado sí trae sus propios
 * botones de imprimir y descargar, que es exactamente lo que hace falta. Para
 * las imágenes, que no traen visor, quedan los botones de abajo.
 */
export function VisorDocumento({
  visor,
  onClose,
}: {
  visor: Visor | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!visor) {
      setUrl(null);
      setError(null);
      return;
    }

    if (visor.tipo === 'blob') {
      const objeto = URL.createObjectURL(visor.blob);
      setUrl(objeto);
      // Se suelta al cerrar: mientras el marco lo esté mostrando, revocarlo
      // dejaría el visor en blanco.
      return () => URL.revokeObjectURL(objeto);
    }

    let vivo = true;
    setUrl(null);
    setError(null);
    void urlArchivo(visor.path)
      .then((u) => vivo && setUrl(u))
      .catch((err) => vivo && setError(describeError(err)));
    return () => {
      vivo = false;
    };
  }, [visor]);

  if (!visor) return null;

  const nombre =
    visor.tipo === 'blob' ? visor.nombre : visor.nombre || `${visor.titulo}.pdf`;
  const esImagen =
    visor.tipo === 'archivo' && /\.(png|jpe?g|gif|webp|bmp)$/i.test(visor.path);

  async function bajar() {
    try {
      if (visor!.tipo === 'blob') {
        descargar(visor!.blob, nombre);
        return;
      }
      const u = url ?? (await urlArchivo(visor!.path));
      const resp = await fetch(u);
      descargar(await resp.blob(), nombre);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal open onClose={onClose} title={visor.titulo} size="xl">
      <div className="overflow-hidden rounded-md border border-sand bg-sand-l">
        {error && (
          <div className="px-4 py-6 text-sm text-rust">{error}</div>
        )}

        {!error && !url && (
          <div className="px-4 py-10 text-center text-sm text-dark-3">Abriendo…</div>
        )}

        {!error && url && (
          esImagen ? (
            <div className="flex max-h-[70vh] justify-center overflow-auto bg-white p-3">
              <img src={url} alt={visor.titulo} className="max-w-full object-contain" />
            </div>
          ) : (
            <iframe
              src={url}
              title={visor.titulo}
              className="h-[70vh] w-full border-0 bg-white"
            />
          )
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-sand px-3 py-2 text-xs font-semibold text-dark-2 hover:bg-sand-l"
          >
            Abrir en otra pestaña
          </a>
        )}
        <button
          type="button"
          onClick={() => void bajar()}
          className="rounded-md border border-teal/40 px-3 py-2 text-xs font-semibold text-teal-d hover:bg-teal-l"
        >
          ⬇ Descargar
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-teal px-4 py-2 text-xs font-extrabold text-white hover:bg-teal-d"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
