import { useMemo } from 'react';
import { Select } from '@/components/ui/Select';
import { useEmpleados, usePersonas } from '@/modules/admin/hooks';

/**
 * Quién entrega, quién pide y quién recibe un documento.
 *
 * Eran tres campos de texto libre, y por eso la misma persona aparecía
 * escrita de cuatro formas: «Murillo/ Angelica», «E. Ventura», el nombre
 * completo... Sin una grafía estable no se puede buscar ni contar nada por
 * persona, que es justo lo que uno quiere saber de un libro de firmas.
 *
 * Sale del catálogo: Personal JD primero --son quienes piden y firman todos
 * los días-- y después los empleados.
 *
 * Guarda el nombre y no el id a propósito: estos tres campos pueden caer en
 * cualquiera de los dos catálogos, y amarrar cada uno a su tabla pediría tres
 * pares de columnas para una ganancia que la grafía estable ya da. Lo que se
 * guardó queda tal cual en el documento, como corresponde a un registro.
 */
export function PersonaSelect({
  name,
  label,
  value,
  onChange,
  hint,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const personasQ = usePersonas();
  const empleadosQ = useEmpleados();

  const personas = personasQ.data ?? [];
  const empleados = empleadosQ.data ?? [];

  // Un registro viejo puede traer un nombre que no está en ningún catálogo.
  // Se muestra igual: borrarlo en silencio al editar sería peor.
  const conocido = useMemo(() => {
    if (!value) return true;
    const v = value.trim().toLowerCase();
    return (
      personas.some((p) => (p.nombre ?? '').trim().toLowerCase() === v) ||
      empleados.some((e) => (e.nombre ?? '').trim().toLowerCase() === v)
    );
  }, [value, personas, empleados]);

  return (
    <div>
      <Select name={name} label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Seleccionar —</option>
        {!conocido && value && <option value={value}>{value} — fuera del catálogo</option>}
        {personas.length > 0 && (
          <optgroup label="Personal JD">
            {personas.map((p) => (
              <option key={p.id} value={p.nombre ?? ''}>
                {p.nombre}
              </option>
            ))}
          </optgroup>
        )}
        {empleados.length > 0 && (
          <optgroup label="Empleados">
            {empleados
              .filter((e) => e.activo !== false)
              .map((e) => (
                <option key={e.id} value={e.nombre ?? ''}>
                  {e.nombre}
                  {e.puesto ? ` · ${e.puesto}` : ''}
                </option>
              ))}
          </optgroup>
        )}
      </Select>
      {!conocido && value ? (
        <p className="mt-1 text-[11px] text-rust">
          Este nombre no está en Personal JD ni en Empleados. Escógelo de la lista para que
          siempre se escriba igual.
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-dark-3">{hint}</p>
      ) : null}
    </div>
  );
}
