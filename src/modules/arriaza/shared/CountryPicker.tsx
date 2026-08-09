import { useMemo, useRef, useState, useEffect } from 'react';
import { COUNTRIES, findCountry, type Country } from '../constants/countries';
import { normTxt } from '../utils';

type Props = {
  value: string | null | undefined;
  onChange: (name: string) => void;
  label?: string;
  placeholder?: string;
  id?: string;
};

// Autocomplete de países con aliases (paridad con ttCountrySearch + ttSetCountry).
// Filtra por nombre normalizado (sin acentos) o por alias.
export function CountryPicker({ value, onChange, label, placeholder, id }: Props) {
  const [query, setQuery] = useState<string>('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sincroniza el input con el value externo cuando cambia (edición).
  useEffect(() => {
    if (value) {
      const c = findCountry(value);
      setQuery(c ? `${c.flag} ${c.name}` : value);
    } else {
      setQuery('');
    }
  }, [value]);

  // Click fuera cierra el dropdown.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const results = useMemo(() => {
    const term = normTxt(query).trim().replace(/^[^a-z]+/, '');
    const list = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    if (!term) return list.slice(0, 60);
    return list
      .filter((c) => normTxt(c.name).includes(term) || (c.aliases && normTxt(c.aliases).includes(term)))
      .slice(0, 60);
  }, [query]);

  function pick(c: Country) {
    onChange(c.name);
    setQuery(`${c.flag} ${c.name}`);
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
        placeholder={placeholder ?? '🌍 Escribe para buscar país…'}
        autoComplete="off"
        className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-sand bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-dark-3">Sin coincidencias</div>
          ) : (
            results.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => pick(c)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-teal-l"
              >
                <span>{c.flag}</span>
                <span>{c.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
