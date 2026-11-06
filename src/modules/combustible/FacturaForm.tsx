import { useMemo, useState, type FormEvent } from 'react';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { formatDate } from '@/lib/dates';
import { formatMoney, parseNumero } from '@/lib/money';
import { useProveedores } from '@/modules/admin/hooks';
import { useSolicitudes } from './hooks';
import type { Factura, FacturaInsert, Solicitud } from './api';

/**
 * Una factura y los vales que cubre.
 *
 * LA RAZON DE QUE EXISTA ESTA PANTALLA la dio la usuaria: «una factura puede
 * llevar mas de un vale [...] el ingreso del monto es manual y eso es
 * causante de doble error, porque en el despacho tambien fue manual».
 *
 * Asi que aqui no se teclea el monto: se escogen los vales y el total sale de
 * sumar sus despachos. Se puede corregir --la gasolinera redondea y el papel
 * es el que vale-- pero entonces la pantalla dice en cuanto se separan. Dos
 * cifras que se pueden desmentir valen mas que una sola en la que hay que
 * confiar.
 */

type Props = {
  inicial?: Factura | null;
  /** Vale que viene preseleccionado al abrirla desde la lista de vales. */
  preseleccion?: string | null;
  onSubmit: (valores: FacturaInsert, solicitudIds: string[]) => void;
  onCancel: () => void;
  guardando?: boolean;
};

type Estado = {
  proveedor_id: string;
  serie: string;
  numero: string;
  fecha: string;
  monto: string;
  contrasena_num: string;
  contrasena_fecha: string;
  contrasena_vencimiento: string;
};

export function FacturaForm({ inicial, preseleccion, onSubmit, onCancel, guardando }: Props) {
  const proveedoresQ = useProveedores();
  const solicitudesQ = useSolicitudes();

  const [v, setV] = useState<Estado>({
    proveedor_id: inicial?.proveedor_id ?? '',
    serie: inicial?.serie ?? '',
    numero: inicial?.numero ?? '',
    fecha: inicial?.fecha ?? new Date().toISOString().slice(0, 10),
    monto: inicial?.monto?.toString() ?? '',
    contrasena_num: inicial?.contrasena_num ?? '',
    contrasena_fecha: inicial?.contrasena_fecha ?? '',
    contrasena_vencimiento: inicial?.contrasena_vencimiento ?? '',
  });
  const set = <K extends keyof Estado>(k: K, x: Estado[K]) => setV((s) => ({ ...s, [k]: x }));

  /**
   * Los vales que puede cubrir: los que ya cubre, mas los despachados que no
   * tienen factura. Un vale sin despacho no entra --no se sabria por cuanto--
   * y uno de otra factura tampoco, para no quitarselo por descuido.
   */
  const candidatos = useMemo(() => {
    const todos = solicitudesQ.data ?? [];
    return todos
      .filter(
        (s) =>
          s.estado !== 'anulada' &&
          (s.factura_id === inicial?.id || (s.factura_id == null && s.monto != null)),
      )
      .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));
  }, [solicitudesQ.data, inicial?.id]);

  const [elegidos, setElegidos] = useState<Set<string>>(() => {
    const ya = (solicitudesQ.data ?? [])
      .filter((s) => inicial?.id && s.factura_id === inicial.id)
      .map((s) => s.id);
    return new Set(preseleccion ? [...ya, preseleccion] : ya);
  });

  const alternar = (id: string) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const sumaDespachos = candidatos
    .filter((s) => elegidos.has(s.id))
    .reduce((a, s) => a + (s.monto ?? 0), 0);

  // Mientras no se escriba nada, el monto ES la suma de los despachos.
  const [montoManual, setMontoManual] = useState(inicial?.monto != null);
  const montoEnPantalla = montoManual
    ? v.monto
    : sumaDespachos > 0
      ? sumaDespachos.toFixed(2)
      : '';
  const monto = montoManual ? parseNumero(v.monto) : sumaDespachos > 0 ? sumaDespachos : null;
  const difiere =
    montoManual && monto != null && sumaDespachos > 0 && Math.abs(monto - sumaDespachos) >= 0.01;

  function enviar(e: FormEvent) {
    e.preventDefault();
    onSubmit(
      {
        proveedor_id: v.proveedor_id || null,
        serie: v.serie.trim() || null,
        numero: v.numero.trim() || null,
        fecha: v.fecha || null,
        monto,
        contrasena_num: v.contrasena_num.trim() || null,
        contrasena_fecha: v.contrasena_fecha || null,
        contrasena_vencimiento: v.contrasena_vencimiento || null,
      },
      [...elegidos],
    );
  }

  const sinDespacho = (solicitudesQ.data ?? []).filter(
    (s) => s.estado !== 'anulada' && s.factura_id == null && s.monto == null,
  ).length;

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Select
        label="Proveedor"
        value={v.proveedor_id}
        onChange={(e) => set('proveedor_id', e.target.value)}
      >
        <option value="">—</option>
        {(proveedoresQ.data ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </Select>

      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput
          label="Serie"
          value={v.serie}
          onChange={(e) => set('serie', e.target.value)}
        />
        <TextInput
          label="Número"
          hint="No se puede repetir."
          value={v.numero}
          onChange={(e) => set('numero', e.target.value)}
          required
        />
        <TextInput
          label="Fecha"
          type="date"
          value={v.fecha}
          onChange={(e) => set('fecha', e.target.value)}
        />
      </div>

      {/* ── Los vales que cubre ─────────────────────────────────────── */}
      <div className="rounded-md border border-sand">
        <div className="flex items-baseline justify-between border-b border-sand bg-sand-l/50 px-3 py-2">
          <h4 className="text-sm font-semibold text-dark">
            Vales que cubre ({elegidos.size})
          </h4>
          <span className="text-sm text-dark-2">
            Suma de despachos: <strong>{formatMoney(sumaDespachos)}</strong>
          </span>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {candidatos.length === 0 && (
            <p className="px-3 py-3 text-sm text-dark-3">
              No hay vales despachados sin factura.
              {sinDespacho > 0 && ` Hay ${sinDespacho} esperando que les captures el despacho.`}
            </p>
          )}
          {candidatos.map((s) => (
            <LineaVale
              key={s.id}
              solicitud={s}
              marcado={elegidos.has(s.id)}
              onToggle={() => alternar(s.id)}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Monto de la factura"
          inputMode="decimal"
          hint={
            difiere
              ? `Ojo: los vales escogidos suman ${formatMoney(sumaDespachos)}`
              : montoManual
                ? 'Lo que dice el papel. Vacíalo para volver a la suma.'
                : 'Suma de los vales escogidos. Puedes escribir encima.'
          }
          value={montoEnPantalla}
          onChange={(e) => {
            const x = e.target.value;
            setMontoManual(x.trim() !== '');
            set('monto', x);
          }}
        />
      </div>

      <div className="rounded-md border border-sand bg-sand-l/40 p-3">
        <p className="mb-2 text-xs text-dark-2">
          Una contraseña por factura. <strong>No sale en el control de vales</strong>: se
          guarda para el expediente y se adjunta en físico.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextInput
            label="Contraseña #"
            value={v.contrasena_num}
            onChange={(e) => set('contrasena_num', e.target.value)}
          />
          <TextInput
            label="Fecha"
            type="date"
            value={v.contrasena_fecha}
            onChange={(e) => set('contrasena_fecha', e.target.value)}
          />
          <TextInput
            label="Vence"
            type="date"
            value={v.contrasena_vencimiento}
            onChange={(e) => set('contrasena_vencimiento', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
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
          {guardando ? 'Guardando…' : inicial ? 'Guardar' : 'Crear factura'}
        </button>
      </div>
    </form>
  );
}

function LineaVale({
  solicitud: s,
  marcado,
  onToggle,
}: {
  solicitud: Solicitud;
  marcado: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 border-b border-sand-l px-3 py-2 text-sm last:border-0 ${
        marcado ? 'bg-teal/5' : 'hover:bg-sand-l/50'
      }`}
    >
      <input
        type="checkbox"
        checked={marcado}
        onChange={onToggle}
        className="h-4 w-4 rounded border-sand text-teal focus:ring-teal"
      />
      <span className="flex-1">
        <span className="font-medium text-dark">{s.serial}</span>{' '}
        <span className="text-dark-3">
          {s.fecha ? formatDate(s.fecha) : ''} · {s.vale_a ?? '—'}
          {s.vale_num ? ` · vale ${s.vale_num}` : ''}
          {s.galones != null ? ` · ${s.galones.toFixed(3)} gal` : ''}
        </span>
      </span>
      <span className="whitespace-nowrap font-medium">
        {s.monto != null ? formatMoney(s.monto) : <span className="text-rust">sin despacho</span>}
      </span>
    </label>
  );
}
