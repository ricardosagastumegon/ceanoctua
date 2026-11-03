import { useState } from 'react';
import { abrirAdjunto } from '@/lib/adjuntos';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';

/** Todo lo que se sube en T&T vive en este bucket, aparte de Finanzas. */
const BUCKET = 'tt-documentos';

/**
 * Abrir un archivo ya subido.
 *
 * Hasta ahora los adjuntos de T&T eran de una sola vía: se podía cargar el
 * boleto, el boarding pass o la confirmación de un hotel, y después no había
 * forma de verlos en ninguna pantalla. Entraban y ahí se quedaban.
 */
export function VerAdjunto({ path, etiqueta = 'Ver' }: { path?: string | null; etiqueta?: string }) {
  const toast = useToast();
  const [abriendo, setAbriendo] = useState(false);

  if (!path) return null;

  async function abrir() {
    if (!path) return;
    setAbriendo(true);
    try {
      await abrirAdjunto(BUCKET, path);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void abrir()}
      disabled={abriendo}
      className="mt-1 w-full rounded-md border border-teal/40 px-3 py-1.5 text-[11px] font-semibold text-teal-d hover:bg-teal-l disabled:opacity-60"
    >
      {abriendo ? 'Abriendo…' : `👁 ${etiqueta}`}
    </button>
  );
}
