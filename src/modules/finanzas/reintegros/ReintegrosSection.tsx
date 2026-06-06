import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useEmpleados, useEntidades } from '@/modules/admin/hooks';
import { KPI } from '@/modules/dashboard/widgets';
import type { Database } from '@/types/database';

// Fase 17 · F-3 — Reintegros como dashboard de lectura sobre los vales
// con `tipo = 'entidad'`. Muestra cuánto ha financiado cada empleado a
// cada entidad. Sin CRUD, sin tabla nueva.

type Vale = Database['public']['Tables']['caja_chica_vales']['Row'];

function fmtMoney(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export function ReintegrosSection(_props: { canEdit: boolean }) {
  const valesQ = useQuery<Vale[], Error>({
    queryKey: ['vales-a-entidad'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caja_chica_vales')
        .select('*')
        .eq('tipo', 'entidad')
        .is('deleted_at', null)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const empleadosQ = useEmpleados();
  const entidadesQ = useEntidades();

  const empleadoById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of empleadosQ.data ?? []) m.set(e.id, e.nombre);
    return m;
  }, [empleadosQ.data]);

  const entidadById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entidadesQ.data ?? []) m.set(e.id, e.nombre);
    return m;
  }, [entidadesQ.data]);

  const byEmpleado = useMemo(() => {
    const map = new Map<
      string,
      { nombre: string; entidades: Map<string, { nombre: string; total: number; vales: Vale[] }>; total: number }
    >();

    for (const v of valesQ.data ?? []) {
      const empId = v.liquidar_a_empleado_id;
      const entId = v.vale_a_entidad_id;
      if (!empId) continue;
      const empNombre = empleadoById.get(empId) ?? v.vale_a;
      const entNombre = entId ? entidadById.get(entId) ?? '?' : v.vale_a;

      const empBucket = map.get(empId) ?? { nombre: empNombre, entidades: new Map(), total: 0 };
      const entBucket =
        empBucket.entidades.get(entId ?? '_unknown') ?? { nombre: entNombre, total: 0, vales: [] };
      entBucket.total += Number(v.monto);
      entBucket.vales.push(v);
      empBucket.entidades.set(entId ?? '_unknown', entBucket);
      empBucket.total += Number(v.monto);
      map.set(empId, empBucket);
    }
    return Array.from(map.entries());
  }, [valesQ.data, empleadoById, entidadById]);

  const grandTotal = byEmpleado.reduce((s, [, v]) => s + v.total, 0);
  const empleadoCount = byEmpleado.length;
  const valesActivos = (valesQ.data ?? []).length;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="font-heading text-xl font-semibold text-dark">Reintegros · Vales a Entidad</h2>
        <p className="mt-1 text-sm text-dark-2">
          Vista de lectura: cuánto ha financiado cada empleado a las entidades vía "Vale a Entidad".
          Para crear un vale, ve a la pestaña <strong>Vales</strong> → <strong>+ Vale a Entidad</strong>.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Empleados con saldos" value={empleadoCount} />
        <KPI label="Vales activos" value={valesActivos} />
        <KPI
          label="Total financiado (GTQ)"
          value={fmtMoney(grandTotal, 'GTQ')}
          tone="warn"
          hint="suma todas las monedas — verifica el cambio"
        />
        <KPI
          label="Estado"
          value={valesQ.isLoading ? '…' : 'Vivo'}
          tone="success"
          hint="actualiza al crear un Vale a Entidad"
        />
      </div>

      {valesQ.isLoading ? (
        <p className="text-sm text-dark-3">Cargando…</p>
      ) : valesQ.isError ? (
        <p className="text-sm text-rust">Error: {valesQ.error.message}</p>
      ) : byEmpleado.length === 0 ? (
        <p className="rounded-md border border-dashed border-sand bg-white p-6 text-center text-sm text-dark-3">
          Aún no hay vales a entidad registrados.
        </p>
      ) : (
        <ul className="space-y-4">
          {byEmpleado.map(([empId, emp]) => (
            <li key={empId} className="rounded-card border border-sand bg-white p-4 shadow-sm">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-lg font-semibold text-dark">{emp.nombre}</h3>
                <span className="font-mono text-base font-semibold text-teal-d">
                  Total: {fmtMoney(emp.total, 'GTQ')}
                </span>
              </header>
              <ul className="mt-3 space-y-3">
                {Array.from(emp.entidades.entries()).map(([entId, ent]) => (
                  <li key={entId} className="rounded-md border border-sand bg-sand-l/30 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-dark">→ {ent.nombre}</span>
                      <span className="font-mono text-sm font-semibold text-dark">
                        {fmtMoney(ent.total, 'GTQ')}
                      </span>
                    </div>
                    <ul className="mt-2 divide-y divide-sand/60 text-xs">
                      {ent.vales.map((v) => (
                        <li key={v.id} className="flex items-center justify-between py-1.5">
                          <span>
                            <span className="font-mono text-teal-d">{v.serial ?? '—'}</span>
                            <span className="ml-2 text-dark-3">{v.fecha ? formatDate(v.fecha) : '—'}</span>
                            {v.concepto && <span className="ml-2 text-dark-2">· {v.concepto}</span>}
                          </span>
                          <span className="font-mono text-dark">
                            {fmtMoney(Number(v.monto), v.moneda)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
