import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
  value: string | null | undefined;
  onChange: (v: string) => void;
  label?: string;
  id?: string;
};

// Dropdown "Pagado con" · lee tarjetas Presi de Supabase.
// Fallback: lista de ejemplo si no hay tarjetas registradas.
export function PaymentMethodSelect({ value, onChange, label, id }: Props) {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancel = false;
    // Intentar leer tarjetas Presi si el módulo existe (nombre configurable).
    // Fallback siempre disponible (paridad ttPaymentMethods del HTML).
    const fallback = [
      'Transferencia Bancaria',
      'Efectivo',
      'Otro',
    ];
    supabase
      .from('tarjetas_credito')
      .select('tc_id, banco, titular, empresa, red')
      .eq('activo', true)
      .then(({ data, error }) => {
        if (cancel) return;
        if (error || !data || data.length === 0) {
          setOptions(fallback);
          return;
        }
        const cards = data.map((t) => {
          const bits = [t.tc_id, t.red, t.banco, t.titular].filter(Boolean);
          return bits.join(' · ');
        });
        setOptions([...cards, ...fallback]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
      >
        <option value="">— Seleccionar —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
