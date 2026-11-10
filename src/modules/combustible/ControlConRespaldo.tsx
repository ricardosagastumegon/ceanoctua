import { useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { armarPdfConAdjuntos, MM, type ArchivoAdjunto } from '@/lib/pdf-hojas';
import { describeError } from '@/modules/admin/hooks';
import type { Reporte } from './api';

/**
 * El control de vales y su respaldo, en UN solo PDF.
 *
 * «Al imprimir no me da la opción de que se imprima el control de vale + el
 * respaldo cargado, tengo que poder imprimirlo completo.»
 *
 * `window.print()` no sabe hacerlo --imprime lo que hay en pantalla, y un PDF
 * ajeno no se puede meter dentro-- así que el documento se arma por programa
 * con la misma máquina que ya usa la solicitud de pago.
 *
 * LA GEOMETRÍA ES LO DELICADO, y ella lo avisó: «cuida los márgenes porque no
 * recuerdo en qué otro documento oficial vi que cuando le das imprimir con
 * expediente, se mueve todo el margen del documento oficial».
 *
 * Tenía razón y el motivo es este: `pdf-hojas` armaba las páginas en CARTA
 * VERTICAL con 24 puntos de margen, siempre. Este control se imprime en CARTA
 * HORIZONTAL con 10mm --se trae su propio `@page` mientras está abierto-- así
 * que meterlo en una página vertical lo encogía hasta caber, y de ahí la
 * sensación de que el margen se movía. No era el margen: era la hoja entera
 * reducida para entrar donde no iba.
 *
 * Por eso aquí se declara la geometría de verdad del documento, y se pagina
 * en vez de encoger: un control de doce vales es más alto que una página, y
 * reducirlo al 25% para que quepa en una lo vuelve ilegible. Paginar es lo
 * que hace el navegador al imprimir.
 */

/** Carta vertical, que es el papel en el que ella lo imprime. */
const CARTA_VERTICAL = {
  ancho: 612,
  alto: 792,
  /** El mismo `margin: 10mm` del `@page` que el imprimible se trae. */
  margen: 10 * MM,
  largo: 'paginar' as const,
  /** Formato oficial: lo dibuja el navegador, no html2canvas. */
  captura: 'fiel' as const,
};

/** El respaldo que alguien subió a este control. */
export function useRespaldoDelControl(reporteId: string | null) {
  return useQuery<ArchivoAdjunto[], Error>({
    queryKey: ['comb_reporte_respaldo', reporteId],
    enabled: reporteId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('nombre, storage_path')
        .eq('entidad_tipo', 'comb_reporte')
        .eq('entidad_id', reporteId as string)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((d) => ({ path: d.storage_path, titulo: d.nombre }));
    },
  });
}

export function BotonControlConRespaldo({
  reporte,
  hoja,
}: {
  reporte: Reporte;
  hoja: RefObject<HTMLDivElement | null>;
}) {
  const toast = useToast();
  const archivosQ = useRespaldoDelControl(reporte.id);
  const [paso, setPaso] = useState<string | null>(null);

  const archivos = archivosQ.data ?? [];
  // Sin respaldo subido no hay nada que juntar, y el botón «Imprimir» de al
  // lado ya hace el documento solo.
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
        CARTA_VERTICAL,
      );
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(reporte.serial ?? 'control-de-vales').replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);

      if (fallidos.length > 0) {
        // Se dice cuál faltó en vez de dejar creer que está completo: un
        // adjunto perdido en silencio es peor que no tenerlo.
        toast.error(`No se pudo incluir: ${fallidos.join(', ')}. El resto sí bajó.`);
      } else {
        toast.success('Control listo, con su respaldo.');
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
      title="Un solo PDF: el control de la quincena y todo lo que lo respalda"
    >
      {paso ?? `📎 Con respaldo (${archivos.length})`}
    </button>
  );
}
