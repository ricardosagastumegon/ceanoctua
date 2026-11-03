// Varias hojas del DOM en un solo PDF descargable.
//
// Por qué no basta con `window.print()`: el navegador imprime lo que está en
// pantalla y deja el archivo en manos del usuario. Acá el PDF se arma por
// programa, capturando cada hoja y poniéndola en su propia página, y sale
// como un Blob que se puede bajar con nombre propio.
//
// Nació para la liquidación de T&T —la hoja más el itinerario en un archivo—
// y vive en `lib` porque el estado de cuenta de combustible hace lo mismo con
// las páginas de su reporte.
//
// Tanto `pdf-lib` como `html2canvas` se cargan solo cuando se genera el
// documento: no engordan el bundle del día a día.

import { supabase } from '@/lib/supabase';

/** Carta en puntos, que es la unidad de pdf-lib. */
const ANCHO = 612;
const ALTO = 792;
const MARGEN = 24;

export type ProgresoExport = {
  paso: string;
  hechos: number;
  total: number;
};

export type ArchivoAdjunto = {
  /** Ruta dentro del bucket. */
  path: string;
  /** Para nombrar el problema si este archivo no se pudo incluir. */
  titulo: string;
};

/** Los primeros bytes de un PDF son siempre `%PDF`. */
function esPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/**
 * Pega al final los archivos que alguien subió.
 *
 * Un PDF aporta todas sus páginas; una imagen se convierte en una página. Si
 * alguno no se puede leer --protegido con clave, formato raro-- se anota y el
 * resto sigue: es peor perder el documento entero que perder una hoja, y
 * quien lo arma tiene que enterarse de cuál faltó.
 */
async function pegarArchivos(
  salida: import('pdf-lib').PDFDocument,
  bucket: string,
  archivos: ArchivoAdjunto[],
  onProgreso: ((p: ProgresoExport) => void) | undefined,
  hechosPrevios: number,
  total: number,
): Promise<string[]> {
  const { PDFDocument } = await import('pdf-lib');
  const fallidos: string[] = [];
  let hechos = hechosPrevios;

  for (const a of archivos) {
    onProgreso?.({ paso: `Agregando ${a.titulo}…`, hechos, total });
    try {
      const { data, error } = await supabase.storage.from(bucket).download(a.path);
      if (error) throw error;
      const bytes = new Uint8Array(await data.arrayBuffer());

      if (esPdf(bytes)) {
        // `ignoreEncryption` para que un PDF con permisos de impresión
        // restringidos --que las aerolíneas y los bancos usan mucho-- no
        // tumbe todo el documento.
        const origen = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const paginas = await salida.copyPages(origen, origen.getPageIndices());
        for (const pag of paginas) salida.addPage(pag);
      } else {
        // pdf-lib solo sabe de PNG y JPG. Se intenta el que corresponda y se
        // cae al otro, porque la extensión del archivo miente a veces.
        let img;
        try {
          img = await salida.embedPng(bytes);
        } catch {
          img = await salida.embedJpg(bytes);
        }
        const util = { w: ANCHO - MARGEN * 2, h: ALTO - MARGEN * 2 };
        const escala = Math.min(util.w / img.width, util.h / img.height, 1);
        const w = img.width * escala;
        const h = img.height * escala;
        const pagina = salida.addPage([ANCHO, ALTO]);
        pagina.drawImage(img, { x: (ANCHO - w) / 2, y: (ALTO - h) / 2, width: w, height: h });
      }
    } catch {
      fallidos.push(a.titulo);
    }
    hechos += 1;
  }

  return fallidos;
}

/**
 * Solo archivos subidos, sin nada capturado de la pantalla.
 *
 * Es lo que usa la documentación de una aeronave: ahí no hay nada que el
 * sistema genere, son los escaneos uno tras otro.
 */
export async function unirArchivos(
  bucket: string,
  archivos: ArchivoAdjunto[],
  onProgreso?: (p: ProgresoExport) => void,
): Promise<{ blob: Blob; fallidos: string[] }> {
  const { PDFDocument } = await import('pdf-lib');
  const salida = await PDFDocument.create();
  const fallidos = await pegarArchivos(salida, bucket, archivos, onProgreso, 0, archivos.length);
  onProgreso?.({ paso: 'Cerrando el documento…', hechos: archivos.length, total: archivos.length });
  const bytes = await salida.save();
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), fallidos };
}

/**
 * La hoja de la aplicación y, detrás, los archivos que se le subieron.
 *
 * Nació del reclamo evidente: se podía adjuntar el boleto y el boarding pass
 * de un vuelo, pero al imprimir la hoja del servicio salía solo la hoja. Un
 * navegador no sabe meter un PDF ajeno dentro de lo que imprime, así que el
 * documento se arma por programa y baja como un archivo.
 */
export async function armarPdfConAdjuntos(
  nodos: HTMLElement[],
  bucket: string,
  archivos: ArchivoAdjunto[],
  onProgreso?: (p: ProgresoExport) => void,
): Promise<{ blob: Blob; fallidos: string[] }> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const total = nodos.length + archivos.length;
  let hechos = 0;

  for (const nodo of nodos) {
    onProgreso?.({ paso: 'Armando la hoja…', hechos, total });
    await pegarHoja(doc, nodo);
    hechos += 1;
  }

  const fallidos = await pegarArchivos(doc, bucket, archivos, onProgreso, hechos, total);

  onProgreso?.({ paso: 'Cerrando el documento…', hechos: total, total });
  const bytes = await doc.save();
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), fallidos };
}

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

/** Captura un nodo y lo pone en su propia página, arriba. */
async function pegarHoja(
  doc: import('pdf-lib').PDFDocument,
  nodo: HTMLElement,
): Promise<void> {
  const png = await capturarNodo(nodo);
  const img = await doc.embedPng(png);
  const util = { w: ANCHO - MARGEN * 2, h: ALTO - MARGEN * 2 };
  // Se encoge para caber a lo ancho; si aun asi es muy alta, manda el alto.
  const escala = Math.min(util.w / img.width, util.h / img.height, 1);
  const w = img.width * escala;
  const h = img.height * escala;
  const pagina = doc.addPage([ANCHO, ALTO]);
  pagina.drawImage(img, { x: (ANCHO - w) / 2, y: ALTO - MARGEN - h, width: w, height: h });
}

/**
 * Arma el documento y lo devuelve como Blob.
 *
 * `nodos` son las hojas de la app, en el orden en que van al papel.
 */
export async function armarPdfDeHojas(
  nodos: HTMLElement[],
  onProgreso?: (p: ProgresoExport) => void,
): Promise<{ blob: Blob }> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const total = nodos.length;
  let hechos = 0;

  for (const nodo of nodos) {
    onProgreso?.({ paso: 'Armando las hojas…', hechos, total });
    await pegarHoja(doc, nodo);
    hechos += 1;
  }

  onProgreso?.({ paso: 'Cerrando el documento…', hechos, total });
  const bytes = await doc.save();
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) };
}
