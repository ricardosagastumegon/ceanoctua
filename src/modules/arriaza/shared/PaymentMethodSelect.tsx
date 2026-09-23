import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Dropdown "Pagado con" · lee las tarjetas del módulo Admin.
 *
 * Devuelve dos cosas y no una: el texto que se ve y el id de la tarjeta. El
 * texto se guarda en `pagado_con` para leerlo de un vistazo; el id va en
 * `pagado_con_id` y es el que suma en la liquidación del viaje.
 *
 * Guardar solo el texto costaba caro: el mismo plástico quedaba escrito de
 * formas distintas según qué campos tuviera llenos la tarjeta, y editarla en
 * Admin dejaba huérfanos los registros viejos. Pasó de verdad el 2026-09-23
 * con la Amex de Guatemala.
 *
 * Las de Presidencia van primero, que son las que más se usan en los viajes,
 * pero las corporativas siguen disponibles para los viajes de empresa.
 */

/** Formas de pago que no son una tarjeta del catálogo. */
const OTROS_MEDIOS = ['Transferencia Bancaria', 'Efectivo', 'Otro'] as const;

type Tarjeta = {
  id: string;
  tc_id: string | null;
  tipo: string | null;
  red: string | null;
  banco: string | null;
  titular: string | null;
};

/** El texto que se muestra y se guarda. */
export function etiquetaTarjeta(t: Tarjeta): string {
  return [t.tc_id, t.red, t.banco, t.titular].filter(Boolean).join(' · ');
}

function useTarjetas() {
  return useQuery({
    queryKey: ['tarjetas_credito', 'pagado_con'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Tarjeta[]> => {
      const { data, error } = await supabase
        .from('tarjetas_credito')
        .select('id, tc_id, tipo, red, banco, titular')
        .eq('activo', true);
      if (error) throw error;
      const filas = (data ?? []) as Tarjeta[];
      // Presidencia primero; dentro de cada grupo, por identificador.
      const peso = (t: Tarjeta) => (t.tipo === 'Presidencia' ? 0 : 1);
      return filas.sort(
        (a, b) => peso(a) - peso(b) || (a.tc_id ?? '').localeCompare(b.tc_id ?? ''),
      );
    },
  });
}

type Props = {
  /** El texto guardado en `pagado_con`. */
  value: string | null | undefined;
  /** El id guardado en `pagado_con_id`, si lo hay. */
  valueId?: string | null;
  onChange: (texto: string, tarjetaId: string | null) => void;
  label?: string;
  id?: string;
};

export function PaymentMethodSelect({ value, valueId, onChange, label, id }: Props) {
  const tarjetas = useTarjetas();
  const filas = tarjetas.data ?? [];
  const presidencia = filas.filter((t) => t.tipo === 'Presidencia');
  const corporativas = filas.filter((t) => t.tipo !== 'Presidencia');

  // Qué opción queda marcada: el id manda, y si no hay id se cae al texto.
  const seleccion = valueId ?? (value ? `texto:${value}` : '');

  // Un registro viejo puede traer un texto que ya no corresponde a ninguna
  // opción. Se muestra igual para no borrarlo en silencio al editar.
  const conocido =
    !value ||
    !!valueId ||
    OTROS_MEDIOS.some((o) => o === value) ||
    filas.some((t) => etiquetaTarjeta(t) === value);

  function handle(v: string) {
    if (v === '') return onChange('', null);
    if (v.startsWith('texto:')) return onChange(v.slice('texto:'.length), null);
    const t = filas.find((x) => x.id === v);
    onChange(t ? etiquetaTarjeta(t) : '', t ? t.id : null);
  }

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
          {label}
        </label>
      )}
      <select
        id={id}
        value={seleccion}
        onChange={(e) => handle(e.target.value)}
        className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
      >
        <option value="">— Seleccionar —</option>
        {!conocido && value && (
          <option value={`texto:${value}`}>{value} — sin identificar</option>
        )}
        {presidencia.length > 0 && (
          <optgroup label="Presidencia">
            {presidencia.map((t) => (
              <option key={t.id} value={t.id}>{etiquetaTarjeta(t)}</option>
            ))}
          </optgroup>
        )}
        {corporativas.length > 0 && (
          <optgroup label="Corporativas">
            {corporativas.map((t) => (
              <option key={t.id} value={t.id}>{etiquetaTarjeta(t)}</option>
            ))}
          </optgroup>
        )}
        <optgroup label="Otros medios">
          {OTROS_MEDIOS.map((o) => (
            <option key={o} value={`texto:${o}`}>{o}</option>
          ))}
        </optgroup>
      </select>
      {!conocido && value && (
        <p className="mt-1 text-[11px] text-rust">
          Esta forma de pago no está en el catálogo de tarjetas. Escógela de la lista para
          que entre en la liquidación.
        </p>
      )}
    </div>
  );
}
