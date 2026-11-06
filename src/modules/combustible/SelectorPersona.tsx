import { Select } from '@/components/ui/Select';

/**
 * Una sola casilla para las DOS listas de gente que hay en la casa.
 *
 * Personal JD (`personas`) y la planilla (`empleados`) son tablas distintas y
 * no se solapan: de las 10 personas de JD, seis no estan en empleados. Los
 * gerentes --los que autorizan y los que piden vales-- estan casi todos en la
 * primera. Pedir solo una de las dos deja fuera a media casa, que es lo que
 * paso con «Vale a» y «Solicitado por».
 *
 * Dos selectores separados dejarian elegir a los dos a la vez, que la base
 * rechaza por CHECK; descubrirlo al guardar es peor que no poder hacerlo. Por
 * eso el valor es uno solo: `jd:<uuid>` o `emp:<uuid>`.
 */

export type Gente = { id: string; nombre: string; puesto?: string | null };

export type Vinculo = { personaId: string | null; empleadoId: string | null };

export function aClave(v: Vinculo): string {
  if (v.personaId) return `jd:${v.personaId}`;
  if (v.empleadoId) return `emp:${v.empleadoId}`;
  return '';
}

export function deClave(valor: string): Vinculo {
  const i = valor.indexOf(':');
  if (i < 0) return { personaId: null, empleadoId: null };
  const origen = valor.slice(0, i);
  const id = valor.slice(i + 1);
  return {
    personaId: origen === 'jd' ? id : null,
    empleadoId: origen === 'emp' ? id : null,
  };
}

/** El nombre que corresponde a una clave, para congelarlo en el documento. */
export function nombreDeClave(valor: string, personas: Gente[], empleados: Gente[]): string | null {
  const { personaId, empleadoId } = deClave(valor);
  if (personaId) return personas.find((p) => p.id === personaId)?.nombre ?? null;
  if (empleadoId) return empleados.find((e) => e.id === empleadoId)?.nombre ?? null;
  return null;
}

export function SelectorPersona({
  label,
  hint,
  value,
  onChange,
  personas,
  empleados,
  required,
  vacio = '—',
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (valor: string) => void;
  personas: Gente[];
  empleados: Gente[];
  required?: boolean;
  vacio?: string;
}) {
  return (
    <Select
      label={label}
      hint={hint}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="">{vacio}</option>
      <optgroup label="Personal JD">
        {personas.map((p) => (
          <option key={p.id} value={`jd:${p.id}`}>
            {p.nombre}
            {p.puesto ? ` · ${p.puesto}` : ''}
          </option>
        ))}
      </optgroup>
      <optgroup label="Empleados">
        {empleados.map((e) => (
          <option key={e.id} value={`emp:${e.id}`}>
            {e.nombre}
            {e.puesto ? ` · ${e.puesto}` : ''}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}
