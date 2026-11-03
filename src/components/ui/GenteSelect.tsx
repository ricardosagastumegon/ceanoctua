import { useMemo } from 'react';
import { Select } from '@/components/ui/Select';
import { useEmpleados, useEntidades, usePersonas } from '@/modules/admin/hooks';

/**
 * Escoger gente de los catálogos de Admin, en vez de escribirla.
 *
 * Nació de los tres campos de texto libre del libro de firmas, donde la misma
 * persona aparecía escrita de cuatro formas --«Murillo/ Angelica», «E.
 * Ventura», el nombre completo--. Sin una grafía estable no se puede buscar ni
 * contar nada por persona.
 *
 * Guarda el NOMBRE y no el id, a propósito: estos campos pueden caer en
 * cualquiera de tres catálogos --Personal JD, Empleados, Entidades-- y
 * amarrar cada uno a su tabla pediría un par de columnas por campo para una
 * ganancia que la grafía estable ya da. Lo que se guardó queda tal cual en el
 * documento, como corresponde a un registro.
 *
 * Ojo: quién firma un documento NO sale de aquí. Eso se elige en el botón de
 * FIRMA y se guarda por id de usuario en `firmas.asignada_a`, que es lo que
 * hace que el documento le aparezca a esa persona en su tablero.
 */

export type GrupoGente = 'jd' | 'empleados' | 'entidades';

const ROTULOS: Record<GrupoGente, string> = {
  jd: 'Personal JD',
  empleados: 'Empleados',
  entidades: 'Entidades',
};

type Opcion = { id: string; nombre: string; pie?: string | null };

/** Las opciones de los grupos pedidos, en el orden en que se pidieron. */
function useOpciones(grupos: GrupoGente[]): { grupo: GrupoGente; opciones: Opcion[] }[] {
  const personasQ = usePersonas();
  const empleadosQ = useEmpleados();
  // Solo se consulta si de verdad se pidió: la mayoría de los campos no lo usa.
  const entidadesQ = useEntidades();

  return useMemo(() => {
    const porGrupo: Record<GrupoGente, Opcion[]> = {
      jd: (personasQ.data ?? []).map((p) => ({ id: p.id, nombre: p.nombre })),
      empleados: (empleadosQ.data ?? [])
        .filter((e) => e.activo !== false)
        .map((e) => ({ id: e.id, nombre: e.nombre, pie: e.puesto })),
      entidades: (entidadesQ.data ?? []).map((e) => ({ id: e.id, nombre: e.nombre })),
    };
    return grupos.map((g) => ({ grupo: g, opciones: porGrupo[g] }));
  }, [grupos, personasQ.data, empleadosQ.data, entidadesQ.data]);
}

function normalizar(s: string): string {
  return s.trim().toLowerCase();
}

/** Un solo nombre, escogido del catálogo. */
export function GenteSelect({
  name,
  label,
  value,
  onChange,
  hint,
  grupos = ['jd', 'empleados'],
  required,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  grupos?: GrupoGente[];
  required?: boolean;
}) {
  const listas = useOpciones(grupos);

  // Un registro viejo puede traer un nombre que no está en ningún catálogo.
  // Se muestra igual: borrarlo en silencio al editar sería peor.
  const conocido = useMemo(() => {
    if (!value) return true;
    const v = normalizar(value);
    return listas.some((l) => l.opciones.some((o) => normalizar(o.nombre) === v));
  }, [value, listas]);

  const rotulos = grupos.map((g) => ROTULOS[g]).join(' o ');

  return (
    <div>
      <Select
        name={name}
        label={label}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Seleccionar —</option>
        {!conocido && value && <option value={value}>{value} — fuera del catálogo</option>}
        {listas.map(
          ({ grupo, opciones }) =>
            opciones.length > 0 && (
              <optgroup key={grupo} label={ROTULOS[grupo]}>
                {opciones.map((o) => (
                  <option key={o.id} value={o.nombre}>
                    {o.nombre}
                    {o.pie ? ` · ${o.pie}` : ''}
                  </option>
                ))}
              </optgroup>
            ),
        )}
      </Select>
      {!conocido && value ? (
        <p className="mt-1 text-[11px] text-rust">
          Este nombre no está en {rotulos}. Escógelo de la lista para que siempre se escriba
          igual.
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-dark-3">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Varios nombres, guardados en una sola columna separados por coma.
 *
 * Hace falta porque hay documentos que de verdad piden a más de uno: en las
 * liquidaciones existentes hay «MAA- LA- JA» y «ANGELES QUEZADA/ MAA». Con un
 * solo desplegable, esos casos obligarían a volver a escribir a mano, que es
 * justo lo que se está quitando.
 */
export function GenteChips({
  name,
  label,
  value,
  onChange,
  hint,
  grupos = ['jd', 'empleados'],
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  grupos?: GrupoGente[];
}) {
  const listas = useOpciones(grupos);

  const elegidos = useMemo(
    () => value.split(',').map((s) => s.trim()).filter(Boolean),
    [value],
  );
  const yaEstan = useMemo(() => new Set(elegidos.map(normalizar)), [elegidos]);

  const enCatalogo = useMemo(() => {
    const todos = new Set<string>();
    for (const l of listas) for (const o of l.opciones) todos.add(normalizar(o.nombre));
    return todos;
  }, [listas]);

  function agregar(nombre: string) {
    if (!nombre || yaEstan.has(normalizar(nombre))) return;
    onChange([...elegidos, nombre].join(', '));
  }

  function quitar(i: number) {
    onChange(elegidos.filter((_, k) => k !== i).join(', '));
  }

  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-semibold uppercase tracking-wider text-dark-2"
      >
        {label}
      </label>
      <select
        id={name}
        value=""
        onChange={(e) => agregar(e.target.value)}
        className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
      >
        <option value="">＋ Agregar…</option>
        {listas.map(
          ({ grupo, opciones }) =>
            opciones.length > 0 && (
              <optgroup key={grupo} label={ROTULOS[grupo]}>
                {opciones
                  .filter((o) => !yaEstan.has(normalizar(o.nombre)))
                  .map((o) => (
                    <option key={o.id} value={o.nombre}>
                      {o.nombre}
                      {o.pie ? ` · ${o.pie}` : ''}
                    </option>
                  ))}
              </optgroup>
            ),
        )}
      </select>

      {elegidos.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {elegidos.map((nombre, i) => {
            const fuera = !enCatalogo.has(normalizar(nombre));
            return (
              <li
                key={`${nombre}-${i}`}
                className={[
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
                  fuera ? 'bg-rust-l text-rust' : 'bg-teal-l text-teal-d',
                ].join(' ')}
                title={fuera ? 'No está en el catálogo' : undefined}
              >
                {fuera ? '⚠' : '👤'} {nombre}
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  className="opacity-60 hover:text-rust hover:opacity-100"
                  aria-label={`Quitar ${nombre}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-dark-3">{hint}</p>
      ) : null}
    </div>
  );
}
