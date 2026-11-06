import { useEffect, useState } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { parseNumero } from '@/lib/money';
import { useResponsables } from './hooks';
import { SelectorPersona, aClave, deClave, nombreDeClave, type Gente } from './SelectorPersona';
import type { Solicitud, SolicitudInsert } from './api';

/**
 * El formulario sigue el orden del papel (OL-RG-0175), no el de la tabla.
 * Quien lo llena tiene la hoja delante o la acaba de recibir de un chofer.
 */

type Props = {
  inicial?: Solicitud | null;
  vehiculos: { id: string; marca: string; placa: string; tipo: string | null }[];
  empleados: Gente[];
  personas: Gente[];
  onSubmit: (valores: SolicitudInsert) => void;
  onCancel: () => void;
  guardando?: boolean;
};

type Estado = {
  fecha: string;
  responsable_id: string;
  vehiculo_id: string;
  /** `jd:<uuid>` o `emp:<uuid>`. Ver SelectorPersona. */
  vale_a: string;
  solicitado_por: string;
  departamento: string;
  justificacion: string;
  autorizado_por_id: string;
  monto_autorizado: string;
  kilometraje_actual: string;
  km_ultima_llenada: string;
  vehiculo_desc: string;
  propietario: string;
  placa_libre: string;
  observaciones: string;
};

const vacio: Estado = {
  fecha: new Date().toISOString().slice(0, 10),
  responsable_id: '',
  vehiculo_id: '',
  vale_a: '',
  solicitado_por: '',
  departamento: '',
  justificacion: '',
  autorizado_por_id: '',
  monto_autorizado: '',
  kilometraje_actual: '',
  km_ultima_llenada: '',
  vehiculo_desc: '',
  propietario: '',
  placa_libre: '',
  observaciones: '',
};

function desdeFila(s: Solicitud): Estado {
  return {
    fecha: s.fecha ?? vacio.fecha,
    responsable_id: s.responsable_id ?? '',
    vehiculo_id: s.vehiculo_id ?? '',
    vale_a: aClave({ personaId: s.vale_a_persona_id, empleadoId: s.vale_a_empleado_id }),
    solicitado_por: aClave({
      personaId: s.solicitado_por_persona_id,
      empleadoId: s.solicitado_por_id,
    }),
    departamento: s.departamento ?? '',
    justificacion: s.justificacion ?? '',
    autorizado_por_id: s.autorizado_por_id ?? '',
    monto_autorizado: s.monto_autorizado?.toString() ?? '',
    kilometraje_actual: s.kilometraje_actual?.toString() ?? '',
    km_ultima_llenada: s.km_ultima_llenada?.toString() ?? '',
    vehiculo_desc: s.vehiculo_desc ?? '',
    propietario: s.propietario ?? '',
    placa_libre: s.placa_libre ?? '',
    observaciones: s.observaciones ?? '',
  };
}

export function SolicitudForm({
  inicial,
  vehiculos,
  empleados,
  personas,
  onSubmit,
  onCancel,
  guardando,
}: Props) {
  const [v, setV] = useState<Estado>(inicial ? desdeFila(inicial) : vacio);
  const responsablesQ = useResponsables();
  const responsables = responsablesQ.data ?? [];

  const resp = responsables.find((r) => r.id === v.responsable_id);
  const esVarios = resp?.tipo_bloque === 'varios';

  /**
   * Al escoger el cuadro se hereda su vehiculo. Es el caso normal --el gerente
   * tiene su carro-- y evita que la solicitud quede con un vehiculo que no
   * corresponde al cuadro donde va a imprimirse.
   */
  useEffect(() => {
    if (resp?.vehiculo_id && !v.vehiculo_id) {
      setV((x) => ({ ...x, vehiculo_id: resp.vehiculo_id as string }));
    }
  }, [resp?.vehiculo_id, v.vehiculo_id]);

  const set = <K extends keyof Estado>(k: K, valor: Estado[K]) =>
    setV((x) => ({ ...x, [k]: valor }));

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const valeA = deClave(v.vale_a);
    const pide = deClave(v.solicitado_por);
    onSubmit({
      fecha: v.fecha,
      responsable_id: v.responsable_id || null,
      vehiculo_id: v.vehiculo_id || null,
      vale_a_persona_id: valeA.personaId,
      vale_a_empleado_id: valeA.empleadoId,
      // Ademas del vinculo se guarda el NOMBRE con el que se imprime. Si
      // dentro de dos anios alguien corrige el catalogo, el papel emitido
      // ese dia no cambia. Mismo criterio que el `snapshot` de un envio.
      vale_a: nombreDeClave(v.vale_a, personas, empleados),
      solicitado_por_id: pide.empleadoId,
      solicitado_por_persona_id: pide.personaId,
      departamento: v.departamento.trim() || null,
      justificacion: v.justificacion.trim() || null,
      autorizado_por_id: v.autorizado_por_id || null,
      monto_autorizado: parseNumero(v.monto_autorizado),
      kilometraje_actual: parseNumero(v.kilometraje_actual),
      km_ultima_llenada: parseNumero(v.km_ultima_llenada),
      vehiculo_desc: esVarios ? v.vehiculo_desc.trim() || null : null,
      propietario: esVarios ? v.propietario.trim() || null : null,
      placa_libre: esVarios ? v.placa_libre.trim() || null : null,
      observaciones: esVarios ? v.observaciones.trim() || null : null,
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Fecha"
          type="date"
          value={v.fecha}
          onChange={(e) => set('fecha', e.target.value)}
          required
        />
        <Select
          label="Cuadro del control de vales"
          hint="Define en qué bloque del reporte sale y qué columnas lleva."
          value={v.responsable_id}
          onChange={(e) => set('responsable_id', e.target.value)}
          required
        >
          <option value="">Escoge…</option>
          {responsables.map((r) => {
            // El cuadro puede ser de Personal JD, de un empleado o de nadie
            // (OTROS, DEPARTAMENTO DE COMPRAS). Se arma el titulo con lo que
            // haya, para que al escoger se vea de quien es.
            const quien =
              personas.find((p) => p.id === r.persona_id)?.nombre ??
              empleados.find((e) => e.id === r.empleado_id)?.nombre ??
              null;
            const titulo =
              [quien ?? r.etiqueta, r.puesto_label].filter(Boolean).join(' · ') ||
              'Sin título';
            return (
              <option key={r.id} value={r.id}>
                {titulo}
              </option>
            );
          })}
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/*
          Obligatorio: es el nombre que lleva el papel. Ademas obliga a
          escogerlo de la lista en las solicitudes viejas que traian el
          nombre escrito a mano, que es justo lo que habia que quitar.
        */}
        <SelectorPersona
          label="Vale a"
          hint="A nombre de quién se emite."
          value={v.vale_a}
          onChange={(x) => set('vale_a', x)}
          personas={personas}
          empleados={empleados}
          vacio="Escoge…"
          required
        />
        <SelectorPersona
          label="Solicitado por"
          hint="Quien lo pide. Suele ser un gerente, y están en Personal JD."
          value={v.solicitado_por}
          onChange={(x) => set('solicitado_por', x)}
          personas={personas}
          empleados={empleados}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Vehículo"
          value={v.vehiculo_id}
          onChange={(e) => set('vehiculo_id', e.target.value)}
        >
          <option value="">—</option>
          {vehiculos.map((x) => (
            <option key={x.id} value={x.id}>
              {x.marca} · {x.placa}
            </option>
          ))}
        </Select>
        <TextInput
          label="Departamento"
          value={v.departamento}
          onChange={(e) => set('departamento', e.target.value)}
        />
      </div>

      {esVarios && (
        <div className="rounded-md border border-sand bg-sand-l/40 p-3">
          <p className="mb-2 text-xs text-dark-2">
            Este cuadro es de <strong>vehículos varios</strong>: el carro cambia en cada
            renglón, así que el control de vales los pide por fila.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Vehículo"
              placeholder="Moto, Carro Finca…"
              value={v.vehiculo_desc}
              onChange={(e) => set('vehiculo_desc', e.target.value)}
            />
            <TextInput
              label="Propietario"
              value={v.propietario}
              onChange={(e) => set('propietario', e.target.value)}
            />
            <TextInput
              label="Placa"
              value={v.placa_libre}
              onChange={(e) => set('placa_libre', e.target.value)}
            />
            <TextInput
              label="Observaciones"
              value={v.observaciones}
              onChange={(e) => set('observaciones', e.target.value)}
            />
          </div>
        </div>
      )}

      <TextArea
        label="Justificación"
        rows={3}
        value={v.justificacion}
        onChange={(e) => set('justificacion', e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput
          label="Monto del vale"
          inputMode="decimal"
          value={v.monto_autorizado}
          onChange={(e) => set('monto_autorizado', e.target.value)}
        />
        <TextInput
          label="Kilometraje actual"
          inputMode="decimal"
          value={v.kilometraje_actual}
          onChange={(e) => set('kilometraje_actual', e.target.value)}
        />
        <TextInput
          label="Km. última llenada"
          inputMode="decimal"
          value={v.km_ultima_llenada}
          onChange={(e) => set('km_ultima_llenada', e.target.value)}
        />
      </div>

      <Select
        label="Autorizado por"
        hint="Personal JD. Es quien firma la solicitud."
        value={v.autorizado_por_id}
        onChange={(e) => set('autorizado_por_id', e.target.value)}
      >
        <option value="">—</option>
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </Select>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-sand px-4 py-2 text-sm text-dark-2 hover:bg-sand-l"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90 disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear solicitud'}
        </button>
      </div>
    </form>
  );
}
