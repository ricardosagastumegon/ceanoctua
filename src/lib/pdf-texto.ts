/**
 * El texto de un PDF, en el orden en que se LEE y no en el que está escrito.
 *
 * POR QUÉ NO BASTA CON CONCATENAR. `pdfjs` devuelve los fragmentos de texto en
 * el orden en que el generador los metió en el archivo, que en las facturas
 * FEL no tiene nada que ver con el orden visual. La primera que se probó salía
 * así:
 *
 *   Total / DATOS DEL CLIENTE / Aeronaves / ... / NIT: 347469 / ...
 *   ... / NIT: 12521337 / Q 1,500.00 / Dirección: / SERIE 75ED0611
 *
 * Con tres «NIT:» sueltos y sin saber cuál es de quién. Buscar «la etiqueta y
 * lo que viene después» no funciona si lo que viene después es de otra parte
 * de la hoja.
 *
 * CÓMO SE ARREGLA. Cada fragmento trae su posición en la página. Se agrupan
 * por renglón --misma `y`, con media línea de tolerancia-- y dentro de cada
 * uno se ordenan por `x`. Eso reconstruye la hoja como se ve, y entonces
 * «Nit Emisor:» y su número vuelven a estar pegados.
 *
 * Las columnas se separan con DOS espacios, que es lo que deja distinguir
 * «Nombre: X» de lo que haya en la columna de al lado del mismo renglón.
 *
 * `pdfjs` se carga SOLO cuando se lee algo: pesa, y no tiene por qué estar en
 * el arranque de quien nunca abre una factura.
 */

/** Media línea de tolerancia para decidir que dos fragmentos van juntos. */
const ALTO_RENGLON = 4;

export async function textoDelPdf(datos: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // El worker va por URL para que Vite lo emita como archivo aparte; sin esto
  // pdfjs intenta cargarlo de una ruta que en producción no existe.
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data: datos }).promise;
  const renglones: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const contenido = await pagina.getTextContent();

    const trozos = contenido.items
      .filter((it): it is typeof it & { str: string; transform: number[] } =>
        'str' in it && 'transform' in it && it.str.trim() !== '')
      .map((it) => ({ x: it.transform[4], y: it.transform[5], s: it.str }));

    const porFila = new Map<number, typeof trozos>();
    for (const t of trozos) {
      const fila = Math.round(t.y / ALTO_RENGLON);
      const lista = porFila.get(fila);
      if (lista) lista.push(t);
      else porFila.set(fila, [t]);
    }

    // De arriba hacia abajo: en PDF la `y` crece hacia arriba.
    for (const [, fila] of [...porFila.entries()].sort((a, b) => b[0] - a[0])) {
      renglones.push(
        fila
          .sort((a, b) => a.x - b.x)
          .map((t) => t.s.trim())
          .join('  '),
      );
    }
  }

  await doc.destroy();
  return renglones.join('\n');
}
