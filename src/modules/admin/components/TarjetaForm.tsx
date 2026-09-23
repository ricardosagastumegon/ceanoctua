import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { Tarjeta, TarjetaInsert } from '../api';
import type { Database } from '@/types/database';
import type { CatalogFormProps } from './CatalogPage';

type TcTipo = Database['public']['Enums']['tc_tipo'];

type FormState = {
  tipo: TcTipo;
  tc_id: string;
  red: string;
  banco: string;
  limite: string;
  notas: string;
  empresa: string;
  nit: string;
  direccion: string;
  titular: string;
  color: string;
};

const empty: FormState = {
  tipo: 'corporativa',
  tc_id: '',
  red: '',
  banco: '',
  limite: '',
  notas: '',
  empresa: '',
  nit: '',
  direccion: '',
  titular: '',
  color: '#0d2b2e',
};

function fromRow(r: Tarjeta | null | undefined): FormState {
  if (!r) return empty;
  return {
    tipo: r.tipo,
    tc_id: r.tc_id ?? '',
    red: r.red ?? '',
    banco: r.banco ?? '',
    limite: r.limite ?? '',
    notas: r.notas ?? '',
    empresa: r.empresa ?? '',
    nit: r.nit ?? '',
    direccion: r.direccion ?? '',
    titular: r.titular ?? '',
    color: r.color ?? '#0d2b2e',
  };
}

function toInput(s: FormState): TarjetaInsert {
  const trim = (v: string) => v.trim() || null;
  const base: TarjetaInsert = {
    tipo: s.tipo,
    tc_id: s.tc_id.trim(),
    red: trim(s.red),
    banco: trim(s.banco),
    limite: trim(s.limite),
    notas: trim(s.notas),
    color: s.color || null,
  };
  if (s.tipo === 'corporativa') {
    base.empresa = trim(s.empresa);
    base.nit = trim(s.nit);
    base.direccion = trim(s.direccion);
    base.titular = null;
  } else {
    base.titular = trim(s.titular);
    base.empresa = null;
    base.nit = null;
    base.direccion = null;
  }
  return base;
}

export function TarjetaForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Tarjeta, TarjetaInsert>) {
  const [values, setValues] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);

  // Cuantos servicios de T&T ya se pagaron con esta tarjeta. Si los hay,
  // cambiarle el identificador mezcla dos historias en una: los cargos viejos
  // salieron en el estado de cuenta del plastico anterior.
  const consumos = useConsumos(initial?.id);
  const cambioElId =
    !!initial && values.tc_id.trim() !== (initial.tc_id ?? '').trim();

  useEffect(() => {
    setValues(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, v: string) {
    setValues((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.tc_id.trim()) {
      setError('El identificador de la tarjeta (tc_id) es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInput(values));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {cambioElId && (consumos.data ?? 0) > 0 && (
        <div className="rounded-md border border-gold bg-gold-light/50 px-3 py-2 text-xs text-dark-2">
          <b>Ojo:</b> esta tarjeta ya tiene {consumos.data} servicio
          {consumos.data === 1 ? '' : 's'} de viaje pagados con ella. Si es una tarjeta
          nueva —por renovación o reposición— conviene <b>crearla aparte</b> y desactivar
          esta, en vez de cambiarle el identificador: los cargos viejos salieron en el
          estado de cuenta del plástico anterior y mezclarlos complica la conciliación.
          Las liquidaciones ya emitidas conservan el nombre con el que se capturaron.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          name="tipo"
          label="Tipo *"
          value={values.tipo}
          onChange={(e) => upd('tipo', e.target.value as TcTipo)}
        >
          <option value="corporativa">Corporativa</option>
          <option value="presidencia">Presidencia</option>
        </Select>
        <TextInput
          name="tc_id"
          label="Identificador / terminación *"
          value={values.tc_id}
          onChange={(e) => upd('tc_id', e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="red" label="Red" value={values.red} onChange={(e) => upd('red', e.target.value)} hint="VISA, Mastercard, Amex…" />
        <TextInput name="banco" label="Banco" value={values.banco} onChange={(e) => upd('banco', e.target.value)} />
        <TextInput name="limite" label="Límite" value={values.limite} onChange={(e) => upd('limite', e.target.value)} />
      </div>

      {/* F-4: color del Ícono en el dashboard de TC corporativas */}
      {values.tipo === 'corporativa' && (
        <div className="flex items-center gap-3 rounded-md border border-sand bg-sand-l/30 p-3">
          <label htmlFor="color-picker" className="text-xs font-semibold uppercase tracking-wider text-dark-2">
            Color de la card
          </label>
          <input
            id="color-picker"
            type="color"
            value={values.color}
            onChange={(e) => upd('color', e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-sand bg-white"
          />
          <TextInput
            name="color"
            label=""
            value={values.color}
            onChange={(e) => upd('color', e.target.value)}
            className="flex-1"
            placeholder="#0d2b2e"
          />
          <div
            className="h-9 w-24 rounded-md text-center text-xs font-semibold leading-9 text-white"
            style={{ background: values.color }}
          >
            preview
          </div>
        </div>
      )}

      {/* Campos condicionales según tipo */}
      {values.tipo === 'corporativa' ? (
        <div className="space-y-4 rounded-md border border-sand bg-sand-l/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-3">Datos corporativos</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              name="empresa"
              label="Empresa"
              value={values.empresa}
              onChange={(e) => upd('empresa', e.target.value)}
            />
            <TextInput name="nit" label="NIT" value={values.nit} onChange={(e) => upd('nit', e.target.value)} />
          </div>
          <TextInput
            name="direccion"
            label="Dirección"
            value={values.direccion}
            onChange={(e) => upd('direccion', e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-4 rounded-md border border-sand bg-sand-l/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-3">Datos de presidencia</p>
          <TextInput
            name="titular"
            label="Titular"
            value={values.titular}
            onChange={(e) => upd('titular', e.target.value)}
          />
        </div>
      )}

      <TextArea
        name="notas"
        label="Notas"
        value={values.notas}
        onChange={(e) => upd('notas', e.target.value)}
      />

      {error && (
        <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60"
        >
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

/** Cuántos servicios de T&T se pagaron con esta tarjeta. */
function useConsumos(tarjetaId: string | undefined) {
  return useQuery({
    queryKey: ['tarjeta_consumos', tarjetaId],
    enabled: !!tarjetaId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<number> => {
      const tablas = [
        'att_tickets', 'att_hoteles', 'att_restaurantes', 'att_rentas',
        'att_tours', 'att_aeronaves', 'att_acuaticos', 'att_ferries',
        'att_terrestres', 'att_actividades',
      ] as const;
      const cuentas = await Promise.all(
        tablas.map(async (t) => {
          const { count, error } = await supabase
            .from(t)
            .select('id', { count: 'exact', head: true })
            .eq('pagado_con_id', tarjetaId as string)
            .is('deleted_at', null);
          if (error) throw error;
          return count ?? 0;
        }),
      );
      return cuentas.reduce((a, b) => a + b, 0);
    },
  });
}
