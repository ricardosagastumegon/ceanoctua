import { useRef, useState, type ChangeEvent } from 'react';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { leerFacturaSP, nitLimpio, type FacturaSP } from './leerFacturaSP';

/**
 * Leer la factura y proponer lo que trae. Opcional, y nunca obligatorio.
 *
 * LA REGLA DE ESTA PANTALLA: propone, no impone. Enseña lo que encontró ANTES
 * de tocar nada, y lo que ya está escrito en el formulario no se pisa solo.
 * Si la factura dice otra cosa que lo capturado, se ven los dos valores y se
 * elige — que dos fuentes puedan desmentirse es lo que convierte un teclazo
 * en algo visible, y es el mismo trato que ya recibe la factura de
 * combustible desde la fase 52.
 *
 * Lo que no encuentra queda vacío. Nunca inventado: un número mal leído en el
 * monto de un pago es peor que teclearlo.
 */

export type CampoLeido = {
  clave: string;
  etiqueta: string;
  /** Lo que dice la factura, ya listo para el formulario. */
  valor: string;
  /** Lo que hay capturado, para poder contrastar. */
  actual: string;
  /** Por qué no se marca solo: ya hay algo distinto escrito. */
  enConflicto: boolean;
};

export function LectorFacturaSP({
  onLeida,
  disabled,
}: {
  /** El resultado y el archivo, para que el formulario decida qué hacer. */
  onLeida: (factura: FacturaSP, archivo: File) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement | null>(null);
  const [leyendo, setLeyendo] = useState(false);

  async function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Se limpia siempre: si no, elegir el mismo archivo dos veces no dispara
    // el evento y parece que el botón dejó de funcionar.
    if (input.current) input.current.value = '';
    if (!file) return;

    setLeyendo(true);
    try {
      const factura = await leerFacturaSP(await file.arrayBuffer());
      if (!factura.autorizacion && factura.total == null) {
        // Sin el UUID de autorización ni un total, no es una factura FEL con
        // texto: puede ser un escaneo. Se dice, en vez de rellenar con nada.
        toast.error(
          'No pude leer esta factura. Si es un escaneo o una foto, el PDF no trae ' +
            'el texto adentro y hay que capturarla a mano.',
        );
        return;
      }
      onLeida(factura, file);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => void alElegir(e)}
      />
      <button
        type="button"
        disabled={disabled || leyendo}
        onClick={() => input.current?.click()}
        className="rounded-md border border-teal/50 bg-teal-l px-3 py-1.5 text-xs font-semibold text-teal-d hover:opacity-90 disabled:opacity-60"
        title="Opcional: lee el PDF de la factura y propone los datos"
      >
        {leyendo ? 'Leyendo…' : '📄 Leer factura (PDF)'}
      </button>
    </>
  );
}

/**
 * El panel de lo leído: cada campo, lo que dice la factura, y si choca con lo
 * capturado. Los que chocan vienen desmarcados a propósito.
 */
export function PanelFactura({
  campos,
  marcados,
  onMarcar,
  onAplicar,
  onDescartar,
  proveedor,
  entidad,
}: {
  campos: CampoLeido[];
  marcados: Set<string>;
  onMarcar: (clave: string) => void;
  onAplicar: () => void;
  onDescartar: () => void;
  /** Qué pasó al buscar el NIT del emisor en el catálogo. */
  proveedor: { estado: 'encontrado' | 'nuevo' | 'sin-nit'; nombre: string | null; nit: string | null };
  /** Y el del receptor entre las entidades. */
  entidad: { estado: 'encontrada' | 'ambigua' | 'no-esta' | 'sin-nit'; nombre: string | null };
}) {
  return (
    <div className="mt-3 rounded-md border border-teal/40 bg-teal-l/30 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-d">
          Lo que dice la factura
        </p>
        <button
          type="button"
          onClick={onDescartar}
          className="text-xs font-semibold text-dark-3 hover:text-rust"
        >
          Descartar
        </button>
      </div>

      <p className="mb-2 text-xs text-dark-2">
        {proveedor.estado === 'encontrado' && (
          <>
            Proveedor <b>{proveedor.nombre}</b>, por su NIT <b>{proveedor.nit}</b>.
          </>
        )}
        {proveedor.estado === 'nuevo' && (
          <>
            El NIT <b>{proveedor.nit}</b> no está en el catálogo de proveedores. Se llena el
            nombre y el NIT, pero tendrás que darlo de alta para elegirlo de la lista.
          </>
        )}
        {proveedor.estado === 'sin-nit' && <>No pude leer el NIT del emisor.</>}
      </p>

      {entidad.estado === 'ambigua' && (
        <p className="mb-2 rounded-md border border-gold/40 bg-gold-light px-2 py-1 text-xs text-dark-2">
          Hay más de una entidad con ese NIT, así que no elijo ninguna: escógela vos.
        </p>
      )}

      <table className="w-full text-xs">
        <tbody>
          {campos.map((c) => (
            <tr key={c.clave} className="border-t border-teal/20">
              <td className="w-6 py-1">
                <input
                  type="checkbox"
                  checked={marcados.has(c.clave)}
                  onChange={() => onMarcar(c.clave)}
                  className="accent-teal"
                />
              </td>
              <td className="py-1 text-dark-3">{c.etiqueta}</td>
              <td className="py-1 font-semibold text-dark">{c.valor}</td>
              <td className="py-1 text-right">
                {c.enConflicto ? (
                  <span className="text-rust">tienes: {c.actual}</span>
                ) : c.actual ? (
                  <span className="text-dark-3">igual</span>
                ) : (
                  <span className="text-dark-3">vacío</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-dark-3">
          El PDF se adjunta al expediente cuando guardes.
        </p>
        <button
          type="button"
          onClick={onAplicar}
          disabled={marcados.size === 0}
          className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-50"
        >
          Aplicar {marcados.size} dato{marcados.size === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}

/** El NIT de un registro del catálogo, comparable con el de una factura. */
export const mismoNit = (a: string | null | undefined, b: string | null | undefined) =>
  !!nitLimpio(a) && nitLimpio(a) === nitLimpio(b);
