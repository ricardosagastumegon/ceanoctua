import { useState, type FormEvent } from 'react';
import { CatalogPage, type CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { useEmpleados, usePersonas } from '@/modules/admin/hooks';
import { useVehiculos } from '@/modules/admin/vehiculos/hooks';
import type { Responsable, ResponsableInsert } from '@/modules/combustible/api';
import {
  useActualizarResponsable,
  useBorrarResponsable,
  useCrearResponsable,
  useResponsables,
} from '@/modules/combustible/hooks';

/**
 * Los cuadros del control de vales OL-RG-0270.
 *
 * Es, literalmente, lo que la asistente marca EN ROJO en su hoja: lo que
 * cambia de un cuadro a otro --marca, tipo, puesto, nombre y placa. Se
 * comprobo celda por celda en el libro que entrego el 5 nov 2026.
 *
 * Es catalogo y no una seccion del reporte porque el cuadro ES un responsable
 * con su vehiculo asignado. Asi ademas da igual que sean cinco, seis o siete:
 * se administran los que haya.
 */

export function ResponsablesSection({ canEdit }: { canEdit: boolean }) {
  const query = useResponsables();
  const create = useCrearResponsable();
  const update = useActualizarResponsable();
  const remove = useBorrarResponsable();
  const empleadosQ = useEmpleados();
  const vehiculosQ = useVehiculos();

  const personasQ = usePersonas();

  const empleado = (id: string | null) =>
    id ? (empleadosQ.data ?? []).find((e) => e.id === id) : null;
  const persona = (id: string | null) =>
    id ? (personasQ.data ?? []).find((p) => p.id === id) : null;

  /**
   * El nombre del cuadro, venga de donde venga. Los gerentes de junta estan
   * en Personal JD y no en la planilla --se comprobo: de las 10 personas de
   * JD, seis no estan en empleados-- asi que el cuadro apunta a una lista o
   * a la otra, nunca a las dos.
   */
  const nombreDe = (r: Responsable) =>
    persona(r.persona_id)?.nombre ?? empleado(r.empleado_id)?.nombre ?? null;
  const vehiculo = (id: string | null) =>
    id ? (vehiculosQ.data ?? []).find((v) => v.id === id) : null;

  const columns: DataTableColumn<Responsable>[] = [
    {
      key: 'orden',
      header: '#',
      className: 'w-10 text-right',
      sortable: true,
      accessor: (r) => r.orden,
      render: (r) => <span className="text-dark-3">{r.orden}</span>,
    },
    {
      key: 'titulo',
      header: 'Cuadro',
      sortable: true,
      accessor: (r) => r.etiqueta ?? nombreDe(r) ?? '',
      render: (r) => (
        <span className="font-medium text-dark">{r.etiqueta ?? nombreDe(r) ?? '—'}</span>
      ),
    },
    {
      key: 'persona',
      header: 'Responsable',
      render: (r) => {
        const n = nombreDe(r);
        if (!n) return <span className="text-dark-3">—</span>;
        return (
          <span>
            {n}
            {r.persona_id && (
              <span className="ml-1.5 rounded bg-teal/15 px-1.5 py-0.5 text-[10px] font-semibold text-teal-d">
                JD
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'puesto',
      header: 'Puesto',
      render: (r) =>
        r.puesto_label ?? empleado(r.empleado_id)?.puesto ?? <span className="text-dark-3">—</span>,
      // Personal JD no guarda puesto: en esos cuadros se escribe a mano.
    },
    {
      key: 'vehiculo',
      header: 'Vehículo',
      render: (r) => {
        const v = vehiculo(r.vehiculo_id);
        if (!v) return <span className="text-dark-3">varios</span>;
        return (
          <span>
            {v.marca} · <span className="font-mono text-xs text-teal-d">{v.placa}</span>
          </span>
        );
      },
    },
    {
      key: 'tipo_bloque',
      header: 'Columnas',
      sortable: true,
      accessor: (r) => r.tipo_bloque,
      render: (r) => (
        <span className="rounded bg-sand-l px-2 py-0.5 text-xs text-dark-2">
          {r.tipo_bloque === 'vehiculo_asignado' ? 'Con kilometraje' : 'Vehículos varios'}
        </span>
      ),
    },
  ];

  return (
    <CatalogPage<Responsable, ResponsableInsert>
      title="Responsables de combustible"
      description="Los cuadros del control de vales. Cada uno imprime su propio bloque, en este orden."
      newLabel="+ Nuevo cuadro"
      modalSize="md"
      columns={columns}
      rows={query.data ?? []}
      loading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => void query.refetch()}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
      onDelete={(id) => remove.mutateAsync(id)}
      submitting={create.isPending || update.isPending}
      Form={ResponsableForm}
      rowLabel={(r) => r.etiqueta ?? nombreDe(r) ?? 'el cuadro'}
      canEdit={canEdit}
    />
  );
}

type Estado = {
  /**
   * Una sola casilla para las dos listas: `jd:<uuid>` o `emp:<uuid>`.
   * Dos selectores separados dejarian elegir a los dos a la vez, que la base
   * rechaza --y descubrirlo al guardar es peor que no poder hacerlo.
   */
  responsable: string;
  etiqueta: string;
  puesto_label: string;
  vehiculo_id: string;
  tipo_bloque: 'vehiculo_asignado' | 'varios';
  orden: string;
};

function ResponsableForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Responsable, ResponsableInsert>) {
  const empleadosQ = useEmpleados();
  const personasQ = usePersonas();
  const vehiculosQ = useVehiculos();

  const [v, setV] = useState<Estado>({
    responsable: initial?.persona_id
      ? `jd:${initial.persona_id}`
      : initial?.empleado_id
        ? `emp:${initial.empleado_id}`
        : '',
    etiqueta: initial?.etiqueta ?? '',
    puesto_label: initial?.puesto_label ?? '',
    vehiculo_id: initial?.vehiculo_id ?? '',
    tipo_bloque: (initial?.tipo_bloque as Estado['tipo_bloque']) ?? 'vehiculo_asignado',
    orden: initial?.orden?.toString() ?? '',
  });
  const set = <K extends keyof Estado>(k: K, x: Estado[K]) => setV((s) => ({ ...s, [k]: x }));

  const esVarios = v.tipo_bloque === 'varios';

  function enviar(e: FormEvent) {
    e.preventDefault();
    const [origen, id] = v.responsable.split(':');
    onSubmit({
      empleado_id: origen === 'emp' ? id : null,
      persona_id: origen === 'jd' ? id : null,
      etiqueta: v.etiqueta.trim() || null,
      puesto_label: v.puesto_label.trim() || null,
      vehiculo_id: v.vehiculo_id || null,
      tipo_bloque: v.tipo_bloque,
      orden: Number(v.orden) || 0,
      activo: initial?.activo ?? true,
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Select
        label="Tipo de cuadro"
        hint="Decide qué columnas imprime en el control de vales."
        value={v.tipo_bloque}
        onChange={(e) => set('tipo_bloque', e.target.value as Estado['tipo_bloque'])}
      >
        <option value="vehiculo_asignado">
          Con vehículo asignado — lleva kilometraje
        </option>
        <option value="varios">
          Vehículos varios — lleva vehículo, propietario y placa por renglón
        </option>
      </Select>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Responsable"
          hint="Los gerentes de junta están en Personal JD, no en la planilla."
          value={v.responsable}
          onChange={(e) => set('responsable', e.target.value)}
        >
          <option value="">—</option>
          <optgroup label="Personal JD">
            {(personasQ.data ?? []).map((p) => (
              <option key={p.id} value={`jd:${p.id}`}>
                {p.nombre}
              </option>
            ))}
          </optgroup>
          <optgroup label="Empleados">
            {(empleadosQ.data ?? []).map((e) => (
              <option key={e.id} value={`emp:${e.id}`}>
                {e.nombre}
                {e.puesto ? ` · ${e.puesto}` : ''}
              </option>
            ))}
          </optgroup>
        </Select>
        <TextInput
          label="Título del cuadro"
          hint="Para los que no son de una persona: OTROS, DEPARTAMENTO DE COMPRAS…"
          value={v.etiqueta}
          onChange={(e) => set('etiqueta', e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Puesto en el formato"
          hint="Personal JD no guarda puesto: ahí hay que escribirlo."
          value={v.puesto_label}
          onChange={(e) => set('puesto_label', e.target.value)}
        />
        <TextInput
          label="Orden"
          inputMode="numeric"
          hint="En qué posición se imprime."
          value={v.orden}
          onChange={(e) => set('orden', e.target.value)}
        />
      </div>

      {/*
        Se ofrece tambien en los cuadros de «varios»: en la hoja original, el
        del mensajero lleva columnas de varios Y su moto en la cabecera
        (YAMAHA / MOTOCICLETA). Las dos cosas son independientes --el tipo de
        cuadro decide QUE COLUMNAS imprime; el vehiculo, que sale arriba.
      */}
      <Select
        label="Vehículo del encabezado"
        hint={
          esVarios
            ? 'Opcional. Si lo dejas vacío, arriba dice «varios».'
            : 'Obligatorio en los cuadros con kilometraje.'
        }
        value={v.vehiculo_id}
        onChange={(e) => set('vehiculo_id', e.target.value)}
        required={!esVarios}
      >
        <option value="">{esVarios ? 'varios' : 'Escoge…'}</option>
        {(vehiculosQ.data ?? []).map((x) => (
          <option key={x.id} value={x.id}>
            {x.marca} · {x.placa}
            {x.tipo ? ` · ${x.tipo}` : ''}
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
          disabled={submitting}
          className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90 disabled:opacity-60"
        >
          {submitting ? 'Guardando…' : initial ? 'Guardar' : 'Crear'}
        </button>
      </div>
    </form>
  );
}
