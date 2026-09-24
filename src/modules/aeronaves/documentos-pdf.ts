// Todos los certificados de un año en un solo PDF.
//
// A diferencia de la liquidación de T&T, aquí no hay nada que el sistema
// genere: son únicamente los archivos que el usuario subió. Así que no hace
// falta capturar pantallas --que es la parte frágil de aquel mecanismo--
// sino solo pegar archivos uno tras otro.
//
// Un PDF aporta todas sus páginas; una imagen se convierte en una página.
// Si alguno no se puede leer --protegido con clave, formato raro-- se anota
// y el resto sigue: en un respaldo es peor perder el documento entero que
// perder una hoja, y el usuario tiene que enterarse de cuál faltó.

import { supabase } from '@/lib/supabase';

/** Carta en puntos, que es la unidad de pdf-lib. */
const ANCHO = 612;
const ALTO = 792;
const MARGEN = 28;

const BUCKET = 'avn-documentos';

export type ProgresoUnion = { paso: string; hechos: number; total: number };

export type ArchivoAUnir = {
  path: string;
  /** Para nombrar el problema si este archivo no se pudo incluir. */
  titulo: string;
};

/** Los primeros bytes de un PDF son siempre `%PDF`. */
function esPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

async function bajar(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

export async function unirDocumentos(
  archivos: ArchivoAUnir[],
  onProgreso?: (p: ProgresoUnion) => void,
): Promise<{ blob: Blob; fallidos: string[] }> {
  const { PDFDocument } = await import('pdf-lib');
  const salida = await PDFDocument.create();
  const fallidos: string[] = [];
  const total = archivos.length;
  let hechos = 0;

  for (const a of archivos) {
    onProgreso?.({ paso: `Agregando ${a.titulo}…`, hechos, total });
    try {
      const bytes = await bajar(a.path);

      if (esPdf(bytes)) {
        // `ignoreEncryption` para que un PDF con permisos de impresión
        // restringidos --que los bancos y las autoridades usan mucho-- no
        // tumbe todo el documento.
        const origen = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const paginas = await salida.copyPages(origen, origen.getPageIndices());
        for (const p of paginas) salida.addPage(p);
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
        pagina.drawImage(img, {
          x: (ANCHO - w) / 2,
          y: (ALTO - h) / 2,
          width: w,
          height: h,
        });
      }
    } catch {
      fallidos.push(a.titulo);
    }
    hechos += 1;
  }

  onProgreso?.({ paso: 'Cerrando el documento…', hechos, total });
  const bytes = await salida.save();
  return {
    blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    fallidos,
  };
}
