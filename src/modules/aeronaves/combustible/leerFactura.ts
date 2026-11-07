/**
 * Leer una factura FEL y sacar de ella lo que el registro necesita.
 *
 * POR QUE SE PUEDE. La factura del Aeroclub es un Documento Tributario
 * Electronico: el PDF trae el texto dentro, no es una foto de un papel. Esto
 * no es adivinar con inteligencia artificial, es leer un formato fijo --el
 * que impone el regimen FEL-- asi que o sale bien o no sale, y no sale a
 * medias ni sale distinto dos veces.
 *
 * LO QUE NO SE INTENTA, y la usuaria lo descarto despues de verlo: el VALE.
 * Es papel con letra a mano fotografiado; leer «55» y «3740» manuscritos
 * necesita reconocimiento de escritura, que falla, y un numero mal leido en
 * un monto es peor que teclearlo. No hace falta: todo lo del vale vuelve en
 * la factura dos dias despues, incluido su propio numero.
 *
 * EL REGALO DEL FORMATO. La factura cita el vale que la origino en el campo
 * «Pedido» --`VRF2044903` es el vale serie RF2 numero 044903-- asi que los
 * dos documentos se amarran solos, sin que nadie tenga que cruzarlos.
 *
 * `pdfjs` se carga SOLO al leer una factura. Pesa, y no tiene por que estar
 * en el arranque de quien nunca abre una: mismo trato que ya recibe `xlsx`.
 */

export type FacturaLeida = {
  serie: string | null;
  numero: string | null;
  fer: string | null;
  /** En ISO, lista para guardar. */
  fecha: string | null;
  total: number | null;
  galones: number | null;
  precioUnitario: number | null;
  producto: string | null;
  /** El vale que cita, ya limpio: `044903` sale como `44903`. */
  vale: string | null;
  nitEmisor: string | null;
  /** El texto entero, por si hay que mirar que paso. */
  crudo: string;
};

/** El texto de un PDF, pagina a pagina, en el orden en que esta escrito. */
async function textoDelPdf(datos: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // El worker va por URL para que Vite lo emita como archivo aparte; sin
  // esto pdfjs intenta cargarlo de una ruta que en produccion no existe.
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data: datos }).promise;
  const partes: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const contenido = await pagina.getTextContent();
    partes.push(
      contenido.items
        .map((it) => ('str' in it ? it.str : ''))
        .join('\n'),
    );
  }
  await doc.destroy();
  return partes.join('\n');
}

const num = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** `31/10/2026` a `2026-10-31`. */
function aIso(dmy: string | null): string | null {
  if (!dmy) return null;
  const m = dmy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export async function leerFactura(datos: ArrayBuffer): Promise<FacturaLeida> {
  const t = await textoDelPdf(datos);
  const uno = (re: RegExp): string | null => t.match(re)?.[1]?.trim() ?? null;

  /**
   * Las cifras de la linea --cantidad, total, precio unitario-- van sueltas y
   * sin etiqueta, cada una en su renglon y en ese orden. Se toman por su
   * forma y no por su posicion absoluta: el IVA y el IDP tambien son cifras
   * sueltas, pero van despues y con otro numero de decimales.
   */
  const cifras = [...t.matchAll(/^\s*([\d,]+\.\d{2,4})\s*$/gm)].map((m) => m[1]);
  const galones = cifras[0]?.includes('.') && cifras[0].split('.')[1].length === 4
    ? num(cifras[0])
    : null;

  const total = num(uno(/Total Compra\s*\n?\s*Q?\s*([\d,]+\.\d{2})/i)) ?? num(cifras[1] ?? null);
  let precio = num(cifras[2] ?? null);
  let gal = galones;

  /**
   * Las tres cifras se sostienen entre si: total = galones x precio. Si una
   * no se reconocio --otro certificador, otra cantidad de decimales-- se
   * despeja de las otras dos en vez de dar el campo por perdido.
   *
   * Se despeja SOLO cuando falta. Si vinieron las tres y no cuadran se dejan
   * como estan: contradecirse es informacion, y taparlo con una division
   * seria borrar justo lo que habria que mirar.
   */
  if (gal == null && total != null && precio) gal = Number((total / precio).toFixed(4));
  if (precio == null && total != null && gal) precio = Number((total / gal).toFixed(4));

  const pedido = uno(/Pedido:\s*(\S+)/i);
  // `VRF2044903` = V + serie RF2 + numero 044903. Se guarda el numero sin los
  // ceros de relleno, que es como lo escribe ella a mano.
  const vale = pedido?.match(/^V[A-Z]{2}\d(\d+)$/)?.[1]?.replace(/^0+/, '') ?? null;

  return {
    serie: uno(/Serie:\s*([A-Z0-9-]+)/i),
    numero: uno(/N[uú]mero:\s*(\d+)/i),
    fer: uno(/Datos Internos:\s*([A-Z]*\d+)/i),
    fecha: aIso(uno(/Fecha de emisi[oó]n:\s*([\d/]+)/i)),
    total,
    galones: gal,
    precioUnitario: precio,
    producto: uno(/^\s*(GASOLINA[^\n]*?)\s*$/im),
    vale,
    nitEmisor: uno(/NIT:\s*(\d+-\d)\s*\nAutoriza/i),
    crudo: t,
  };
}

/** Un campo que la factura contradice: lo que hay, y lo que dice el papel. */
export type Desacuerdo = { campo: string; registro: string; factura: string };

/**
 * Compara lo leido con lo que ya tiene el registro.
 *
 * No es decoracion. El vale se teclea a mano el dia que llega, y la factura
 * llega dos dias despues con las mismas cifras: son dos fuentes del mismo
 * dato, y que puedan desmentirse es lo unico que convierte un teclazo en algo
 * que se ve. Si solo se sobrescribiera en silencio, un «3470» por «3740» se
 * corregiria sin que nadie se enterara de que lo hubo.
 */
export function compararConElRegistro(
  f: FacturaLeida,
  r: { vale: string | null; factura: string | null; fer_ap: string | null; fecha: string | null },
): Desacuerdo[] {
  const d: Desacuerdo[] = [];
  const mete = (campo: string, hay: string | null, dice: string | null) => {
    if (!hay?.trim() || !dice?.trim()) return;
    if (hay.trim().toUpperCase() !== dice.trim().toUpperCase()) {
      d.push({ campo, registro: hay.trim(), factura: dice.trim() });
    }
  };
  mete('Vale', r.vale, f.vale);
  mete('Factura', r.factura, f.numero);
  mete('FER/AP', r.fer_ap, f.fer);
  mete('Fecha', r.fecha, f.fecha);
  return d;
}
