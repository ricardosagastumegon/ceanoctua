// La liquidación completa en un solo PDF.
//
// El usuario guarda la liquidación entera como respaldo, así que el documento
// junta en un archivo: la hoja de liquidación, el itinerario general y las
// confirmaciones que se subieron de cada servicio.
//
// Por qué no basta con `window.print()`: el navegador imprime lo que está en
// pantalla y no sabe pegarle archivos. Aquí el PDF se arma por programa --
// cada hoja de la app se captura como imagen y se le anexan los archivos
// guardados en Storage, tal cual, sin reprocesarlos.
//
// Tanto `pdf-lib` como `html2canvas` se cargan solo cuando se genera el
// documento: no engordan el bundle del día a día.

import { supabase } from '@/lib/supabase';

/** Carta en puntos, que es la unidad de pdf-lib. */
const ANCHO = 612;
const ALTO = 792;
const MARGEN = 24;

export type Anexo = {
  /** Ruta en el bucket `tt-documentos`. */
  path: string;
  /** Para el aviso cuando un archivo no se pudo leer. */
  titulo: string;
};

export type ProgresoExport = {
  paso: string;
  hechos: number;
  total: number;
};

/**
 * Convierte un nodo del DOM en PNG.
 *
 * `scale: 2` porque a escala 1 el texto chico del PDF sale borroso al
 * imprimirlo.
 */
async function capturarNodo(nodo: HTMLElement): Promise<Uint8Array> {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(nodo, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
  });
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function descargarAnexo(path: string): Promise<{ bytes: Uint8Array; tipo: string } | null> {
  const { data, error } = await supabase.storage.from('tt-documentos').download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { bytes, tipo: data.type || '' };
}

/**
 * Arma el documento y lo devuelve como Blob.
 *
 * `nodos` son las hojas de la app en el orden en que van; `anexos` los
 * archivos que se subieron. Un anexo que no se pueda leer no tumba el
 * documento: se reporta y se sigue.
 */
export async function armarLiquidacionCompleta(
  nodos: HTMLElement[],
  anexos: Anexo[],
  onProgreso?: (p: ProgresoExport) => void,
): Promise<{ blob: Blob; fallidos: string[] }> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const total = nodos.length + anexos.length;
  let hechos = 0;

  const avisar = (paso: string) => {
    onProgreso?.({ paso, hechos, total });
  };

  // 1 · Las hojas de la app, como imagen a página completa.
  for (const nodo of nodos) {
    avisar('Armando las hojas del viaje…');
    const png = await capturarNodo(nodo);
    const img = await doc.embedPng(png);
    const util = { w: ANCHO - MARGEN * 2, h: ALTO - MARGEN * 2 };
    // Se encoge para caber a lo ancho; si aun asi es muy alta, manda el alto.
    const escala = Math.min(util.w / img.width, util.h / img.height, 1);
    const w = img.width * escala;
    const h = img.height * escala;
    const pagina = doc.addPage([ANCHO, ALTO]);
    pagina.drawImage(img, { x: (ANCHO - w) / 2, y: ALTO - MARGEN - h, width: w, height: h });
    hechos += 1;
  }

  // 2 · Las confirmaciones, tal como se subieron.
  const fallidos: string[] = [];
  for (const anexo of anexos) {
    avisar(`Anexando ${anexo.titulo}…`);
    try {
      const archivo = await descargarAnexo(anexo.path);
      if (!archivo) {
        fallidos.push(anexo.titulo);
        hechos += 1;
        continue;
      }
      const esPdf =
        archivo.tipo.includes('pdf') || anexo.path.toLowerCase().endsWith('.pdf');
      if (esPdf) {
        const origen = await PDFDocument.load(archivo.bytes);
        const paginas = await doc.copyPages(origen, origen.getPageIndices());
        for (const p of paginas) doc.addPage(p);
      } else {
        const esPng =
          archivo.tipo.includes('png') || anexo.path.toLowerCase().endsWith('.png');
        const img = esPng
          ? await doc.embedPng(archivo.bytes)
          : await doc.embedJpg(archivo.bytes);
        const util = { w: ANCHO - MARGEN * 2, h: ALTO - MARGEN * 2 };
        const escala = Math.min(util.w / img.width, util.h / img.height, 1);
        const w = img.width * escala;
        const h = img.height * escala;
        const pagina = doc.addPage([ANCHO, ALTO]);
        pagina.drawImage(img, {
          x: (ANCHO - w) / 2, y: (ALTO - h) / 2, width: w, height: h,
        });
      }
    } catch {
      // Un adjunto roto o en un formato que pdf-lib no entiende no puede
      // tumbar toda la liquidación.
      fallidos.push(anexo.titulo);
    }
    hechos += 1;
  }

  avisar('Cerrando el documento…');
  const bytes = await doc.save();
  return {
    blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    fallidos,
  };
}

export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  // El ancla tiene que estar en el documento y el enlace no se puede soltar
  // enseguida: revocarlo en la misma vuelta aborta la descarga antes de que
  // el navegador alcance a leer el blob.
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}
