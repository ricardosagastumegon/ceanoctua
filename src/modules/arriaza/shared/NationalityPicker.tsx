import { useEffect, useMemo, useRef, useState } from 'react';
import { NACIONALIDADES, findNacionalidad } from '../constants/nationalities';
import { normTxt } from '../utils';

type Props = {
  /** Códigos ISO alfa-3 ya elegidos. */
  value: string[];
  onChange: (codes: string[]) => void;
  label?: string;
};

/**
 * Buscador de nacionalidades con selección múltiple.
 *
 * Reemplaza al `<select multiple>` que había: obligaba a desplazarse por 214
 * países sin poder filtrar y a saber que se seleccionaba con Ctrl. Aquí se
 * escribe, se filtra y lo elegido se apila debajo.
 *
 * Busca por código y por nombre, sin acentos, así que "guate" y "GTM" llegan
 * al mismo lugar.
 */
export function NationalityPicker({ value, onChange, label }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const resultados = useMemo(() => {
    const term = normTxt(query).trim();
    const disponibles = NACIONALIDADES.filter((n) => !value.includes(n.code));
    if (!term) return disponibles.slice(0, 50);
    return disponibles
      .filter((n) => normTxt(n.code).startsWith(term) || normTxt(n.nombre).includes(term))
      .slice(0, 50);
  }, [query, value]);

  function agregar(code: string) {
    if (!value.includes(code)) onChange([...value, code]);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
          {label}
        </label>
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          // Enter elige la primera coincidencia: con "gtm" escrito, entra sola.
          if (e.key === 'Enter' && resultados.length > 0) {
            e.preventDefault();
            agregar(resultados[0].code);
          }
        }}
        placeholder="Busca por código o país…"
        autoComplete="off"
        className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
      />

      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-sand bg-white shadow-lg">
          {resultados.length === 0 ? (
            <div className="px-3 py-2 text-xs text-dark-3">Sin coincidencias</div>
          ) : (
            resultados.map((n) => (
              <button
                key={n.code}
                type="button"
                onClick={() => agregar(n.code)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-teal-l"
              >
                <span className="w-10 shrink-0 font-mono font-extrabold text-teal-d">{n.code}</span>
                <span className="text-dark-2">{n.nombre}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Lo elegido, apilado debajo en el orden en que se agregó. */}
      {value.length > 0 && (
        <ul className="mt-2 space-y-1">
          {value.map((code) => {
            const n = findNacionalidad(code);
            return (
              <li
                key={code}
                className="flex items-center gap-2 rounded-md bg-teal-l px-2 py-1 text-xs"
              >
                <span className="w-10 shrink-0 font-mono font-extrabold text-teal-d">{code}</span>
                <span className="flex-1 truncate text-dark-2">{n?.nombre ?? '—'}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((c) => c !== code))}
                  className="shrink-0 text-teal-d/60 hover:text-rust"
                  aria-label={`Quitar ${code}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
