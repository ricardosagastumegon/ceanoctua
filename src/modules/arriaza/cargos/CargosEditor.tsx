import { useMemo } from 'react';
import { useTarjetas } from '@/modules/admin/hooks';
import type { CargoInput } from './api';

/**
 * Los cargos adicionales de un servicio.
 *
 * Cada renglón es un cobro aparte: su descripción, su monto, **con qué se
 * pagó y cuándo**. Eso último es lo que faltaba: antes el extra se sumaba al
 * servicio y al liquidar se le cargaba a la tarjeta del servicio, aunque se
 * hubiera pagado otro día y con otra.
 *
 * El mismo componente sirve para los once servicios. En el ticket además
 * deja decir de qué pasajero es el cargo.
 */
export function CargosEditor({
  cargos,
  onChange,
  moneda,
  pasajeros,
}: {
  cargos: CargoInput[];
  onChange: (c: CargoInput[]) => void;
  moneda: string;
  /** Solo el ticket los manda: permite amarrar el cargo a un pasajero. */
  pasajeros?: { id: string; nombre: string }[];
}) {
  const tarjetas = useTarjetas();

  /**
   * Las de PRESIDENCIA primero, que son las que más se usan; el resto
   * después, porque a veces se paga con una corporativa.
   */
  const opciones = useMemo(() => {
    const lista = (tarjetas.data ?? []).filter((t) => t.activo !== false);
    const peso = (t: { tipo?: string | null }) =>
      (t.tipo ?? '').toUpperCase().includes('PRESIDENCIA') ? 0 : 1;
    return [...lista].sort(
      (a, b) => peso(a) - peso(b) || (a.tc_id ?? '').localeCompare(b.tc_id ?? ''),
    );
  }, [tarjetas.data]);

  const total = cargos.reduce((s, c) => {
    const n = Number(c.monto);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);

  function set(i: number, patch: Partial<CargoInput>) {
    onChange(cargos.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  }

  function agregar() {
    onChange([
      ...cargos,
      { descripcion: '', monto: '', pagado_con_id: '', fecha_cargo: '', pax_id: null },
    ]);
  }

  return (
    <section className="rounded-md border border-sand bg-sand-l/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-d">
            Cargos adicionales
          </span>
          <p className="mt-0.5 text-[11px] text-dark-3">
            Asientos, maletas, cambios de fecha… Cada uno con lo que se pagó y cuándo, porque
            casi nunca es la misma tarjeta ni el mismo día del servicio.
          </p>
        </div>
        <button
          type="button"
          onClick={agregar}
          className="rounded-md border border-teal/40 px-2.5 py-1 text-[11px] font-extrabold text-teal-d hover:bg-teal-l"
        >
          ＋ Cargo
        </button>
      </div>

      {cargos.length === 0 && (
        <p className="py-2 text-[11px] italic text-dark-3">Sin cargos adicionales.</p>
      )}

      <div className="space-y-2">
        {cargos.map((c, i) => (
          <div
            key={c.id ?? `nuevo-${i}`}
            className="grid grid-cols-1 gap-2 rounded-md border border-sand bg-white p-2 sm:grid-cols-[1.6fr_.8fr_1.2fr_1fr_auto]"
          >
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold text-dark-3">Descripción</span>
              <input
                type="text"
                value={c.descripcion}
                onChange={(e) => set(i, { descripcion: e.target.value })}
                placeholder="ej. Asiento y maleta documentada"
                className="block w-full rounded border border-sand px-2 py-1.5 text-sm focus:border-teal focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold text-dark-3">
                Monto ({moneda})
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={c.monto}
                onChange={(e) => set(i, { monto: e.target.value })}
                className="block w-full rounded border border-sand px-2 py-1.5 text-right text-sm focus:border-teal focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold text-dark-3">Pagado con</span>
              <select
                value={c.pagado_con_id}
                onChange={(e) => set(i, { pagado_con_id: e.target.value })}
                className="block w-full rounded border border-sand bg-white px-2 py-1.5 text-sm focus:border-teal focus:outline-none"
              >
                <option value="">Sin definir…</option>
                {opciones.map((t) => (
                  <option key={t.id} value={t.id}>
                    {[t.tc_id, t.red, t.banco].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold text-dark-3">
                Fecha de pago
              </span>
              <input
                type="date"
                value={c.fecha_cargo}
                onChange={(e) => set(i, { fecha_cargo: e.target.value })}
                className="block w-full rounded border border-sand px-2 py-1.5 text-sm focus:border-teal focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={() => onChange(cargos.filter((_, k) => k !== i))}
              className="self-end pb-1.5 text-dark-3 hover:text-rust"
              aria-label="Quitar cargo"
            >
              ✕
            </button>

            {pasajeros && pasajeros.length > 0 && (
              <label className="block sm:col-span-5">
                <span className="mb-0.5 block text-[10px] font-semibold text-dark-3">
                  ¿De qué pasajero es? (opcional)
                </span>
                <select
                  value={c.pax_id ?? ''}
                  onChange={(e) => set(i, { pax_id: e.target.value || null })}
                  className="block w-full rounded border border-sand bg-white px-2 py-1.5 text-sm focus:border-teal focus:outline-none sm:w-64"
                >
                  <option value="">Del ticket completo</option>
                  {pasajeros.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ))}
      </div>

      {cargos.length > 0 && (
        <div className="mt-2 flex items-baseline justify-end gap-3 border-t border-sand pt-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-dark-2">
            Total en cargos
          </span>
          <span className="font-heading text-sm font-extrabold text-teal-d">
            {moneda} {total.toFixed(2)}
          </span>
        </div>
      )}
    </section>
  );
}
