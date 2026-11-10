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

/** Un milimetro en puntos, para traducir los `@page { margin: Nmm }`. */
export const MM = 2.8346457;

/**
 * Como va la hoja capturada a su pagina.
 *
 * Existe porque la geometria estaba clavada en vertical con 24 puntos, y no
 * todos los documentos del sistema son asi. El control de vales se imprime en
 * CARTA HORIZONTAL con 10mm --se trae su propio `@page` mientras esta
 * abierto-- y meterlo en una pagina vertical lo encogia hasta la mitad de su
 * tamaño. Eso es lo que ella vio como «se mueve todo el margen del documento
 * oficial»: no era el margen, era la hoja entera reducida para caber donde no
 * iba.
 */
export type HojaGeometria = {
  /** Puntos. Carta vertical por omision. */
  ancho?: number;
  alto?: number;
  margen?: number;
  /**
   * Que hacer cuando la hoja es mas alta que su pagina.
   *
   * `encoger` la reduce hasta que quepa entera --lo de siempre, y lo correcto
   * para una hoja que ya viene del tamaño de una pagina--. `paginar` la corta
   * en tantas paginas como haga falta respetando el ancho, que es lo que hace
   * el navegador al imprimir: un control de doce vales no se lee si se
   * encoge al 25% para caber en una sola.
   */
  largo?: 'encoger' | 'paginar';
};

function geometria(g?: HojaGeometria) {
  return {
    ancho: g?.ancho ?? ANCHO,
    alto: g?.alto ?? ALTO,
    margen: g?.margen ?? MARGEN,
    largo: g?.largo ?? 'encoger',
  };
}

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
  hoja?: HojaGeometria,
): Promise<{ blob: Blob; fallidos: string[] }> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const total = nodos.length + archivos.length;
  let hechos = 0;

  for (const nodo of nodos) {
    onProgreso?.({ paso: 'Armando la hoja…', hechos, total });
    await pegarHoja(doc, nodo, hoja);
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
async function capturarNodo(nodo: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(nodo, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
  });
}

/** Un canvas en bytes PNG, que es lo que pdf-lib sabe incrustar. */
function pngDeCanvas(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Dónde cortar de verdad, para no partir un renglón por la mitad.
 *
 * El corte a ciegas en el límite exacto de la página parte lo que haya ahí:
 * la primera prueba cortó el pie del control de vales en dos --el recuadro de
 * la firma en una página y su contenido en la otra--. El navegador no hace
 * eso: rompe entre filas.
 *
 * Desde el corte ideal se busca hacia ARRIBA una franja de píxeles toda
 * blanca, que es donde la hoja respira entre un bloque y el siguiente. Si no
 * aparece en el último tercio, se corta donde tocaba: más vale una página
 * partida que un bucle sin fin o una página casi vacía.
 */
function corteLimpio(datos: Uint8ClampedArray, ancho: number, ideal: number, minimo: number): number {
  const blanca = (y: number) => {
    // De cuatro en cuatro píxeles: una línea de tabla nunca es tan fina como
    // para colarse entre ellos, y recorrer 1800 columnas por fila sí se nota.
    for (let x = 0; x < ancho; x += 4) {
      const i = (y * ancho + x) * 4;
      if (datos[i] < 246 || datos[i + 1] < 246 || datos[i + 2] < 246) return false;
    }
    return true;
  };
  for (let y = ideal; y > minimo; y--) {
    if (blanca(y)) return y;
  }
  return ideal;
}

/** Captura un nodo y lo pone en su página, arriba y dentro de su margen. */
async function pegarHoja(
  doc: import('pdf-lib').PDFDocument,
  nodo: HTMLElement,
  g?: HojaGeometria,
): Promise<void> {
  const { ancho, alto, margen, largo } = geometria(g);
  const canvas = await capturarNodo(nodo);
  const util = { w: ancho - margen * 2, h: alto - margen * 2 };

  if (largo === 'encoger') {
    const img = await doc.embedPng(pngDeCanvas(canvas));
    // Se encoge para caber a lo ancho; si aun asi es muy alta, manda el alto.
    const escala = Math.min(util.w / img.width, util.h / img.height, 1);
    const w = img.width * escala;
    const h = img.height * escala;
    const pagina = doc.addPage([ancho, alto]);
    pagina.drawImage(img, { x: (ancho - w) / 2, y: alto - margen - h, width: w, height: h });
    return;
  }

  // Paginar: el ancho manda, y lo que sobra de alto pasa a la pagina
  // siguiente. Cortar el canvas y no la imagen ya incrustada, porque pdf-lib
  // no recorta: lo que entra en una pagina se decide aqui.
  const escala = Math.min(util.w / canvas.width, 1);
  const altoPorPagina = Math.max(1, Math.floor(util.h / escala));

  const lector = canvas.getContext('2d', { willReadFrequently: true });
  const pixeles = lector?.getImageData(0, 0, canvas.width, canvas.height).data;

  let y = 0;
  while (y < canvas.height) {
    let altoTrozo = Math.min(altoPorPagina, canvas.height - y);
    // Solo si queda hoja por delante: el último trozo se toma entero.
    if (pixeles && y + altoTrozo < canvas.height) {
      const corte = corteLimpio(
        pixeles,
        canvas.width,
        y + altoTrozo,
        y + Math.floor(altoPorPagina * 0.66),
      );
      altoTrozo = corte - y;
    }
    const trozo = document.createElement('canvas');
    trozo.width = canvas.width;
    trozo.height = altoTrozo;
    const ctx = trozo.getContext('2d');
    if (!ctx) throw new Error('El navegador no pudo preparar la hoja para el PDF.');
    // Fondo blanco explicito: sin el, un corte sin contenido sale negro.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, trozo.width, trozo.height);
    ctx.drawImage(canvas, 0, y, canvas.width, altoTrozo, 0, 0, canvas.width, altoTrozo);

    const img = await doc.embedPng(pngDeCanvas(trozo));
    const w = canvas.width * escala;
    const h = altoTrozo * escala;
    const pagina = doc.addPage([ancho, alto]);
    pagina.drawImage(img, { x: (ancho - w) / 2, y: alto - margen - h, width: w, height: h });
    y += altoTrozo;
  }
}

/**
 * Arma el documento y lo devuelve como Blob.
 *
 * `nodos` son las hojas de la app, en el orden en que van al papel.
 */
export async function armarPdfDeHojas(
  nodos: HTMLElement[],
  onProgreso?: (p: ProgresoExport) => void,
  hoja?: HojaGeometria,
): Promise<{ blob: Blob }> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const total = nodos.length;
  let hechos = 0;

  for (const nodo of nodos) {
    onProgreso?.({ paso: 'Armando las hojas…', hechos, total });
    await pegarHoja(doc, nodo, hoja);
    hechos += 1;
  }

  onProgreso?.({ paso: 'Cerrando el documento…', hechos, total });
  const bytes = await doc.save();
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) };
}
