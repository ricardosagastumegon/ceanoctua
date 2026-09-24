// La liquidación en un solo PDF: la hoja de liquidación y el itinerario.
//
// El usuario guarda la liquidación como respaldo y quiere las dos hojas en un
// archivo. Los documentos que él sube -- confirmaciones, boletos -- NO van
// aquí: los pidió fuera explícitamente.
//
// Por qué no basta con `window.print()`: el navegador imprime una sola cosa,
// la que está en pantalla. Aquí el PDF se arma por programa, capturando cada
// hoja y poniéndolas en páginas del mismo documento.
//
// Tanto `pdf-lib` como `html2canvas` se cargan solo cuando se genera el
// documento: no engordan el bundle del día a día.

// `descargar` se mudo a `@/lib/descargar`: tambien lo usa Aeronaves.

/** Carta en puntos, que es la unidad de pdf-lib. */
const ANCHO = 612;
const ALTO = 792;
const MARGEN = 24;

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

/**
 * Arma el documento y lo devuelve como Blob.
 *
 * `nodos` son las hojas de la app, en el orden en que van al papel.
 */
export async function armarLiquidacionCompleta(
  nodos: HTMLElement[],
  onProgreso?: (p: ProgresoExport) => void,
): Promise<{ blob: Blob }> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const total = nodos.length;
  let hechos = 0;

  for (const nodo of nodos) {
    onProgreso?.({ paso: 'Armando las hojas del viaje…', hechos, total });
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

  onProgreso?.({ paso: 'Cerrando el documento…', hechos, total });
  const bytes = await doc.save();
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) };
}
