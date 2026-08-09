import { useEffect, useMemo, useRef, useState } from 'react';
import { AIRPORTS, findAirport, type Airport } from '../constants/airports';

type Props = {
  value: string | null | undefined;
  onChange: (code: string, airport: Airport | null) => void;
  label?: string;
  placeholder?: string;
  id?: string;
};

// Autocomplete de aeropuertos IATA · paridad con ttAirportSearch/ttPickAirport.
// Filtra por code / city / name / country.
export function AirportPicker({ value, onChange, label, placeholder, id }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const a = findAirport(value);
      setQuery(a ? `${a.code} — ${a.city}` : value);
    } else {
      setQuery('');
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return AIRPORTS.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q),
    ).slice(0, 12);
  }, [query]);

  function pick(a: Airport) {
    onChange(a.code, a);
    setQuery(`${a.code} — ${a.city}`);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder ?? 'Código IATA o ciudad…'}
        autoComplete="off"
        className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
      />
      {open && query && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-sand bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-dark-3">Sin coincidencias</div>
          ) : (
            results.map((a) => (
              <button
                key={a.code}
                type="button"
                onClick={() => pick(a)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-teal-l"
              >
                <span>
                  <span className="font-extrabold text-teal-d">{a.code}</span> — {a.name}
                </span>
                <span className="text-xs text-dark-3">
                  {a.city}, {a.country}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
