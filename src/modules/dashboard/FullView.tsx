import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAllTareas } from '@/modules/board/tareas/hooks';
import { useAllViajes } from '@/modules/board/viajes/hooks';
import { useFirmas } from '@/modules/cea/firmas/hooks';
import { usePagos } from '@/modules/finanzas/pagos/hooks';
import { useReintegros } from '@/modules/finanzas/reintegros/hooks';
import { useConsumos } from '@/modules/finanzas/consumos/hooks';
import { useVales } from '@/modules/cc-board/vales/hooks';
import { useLiquidaciones } from '@/modules/cc-board/liquidaciones/hooks';
import { businessDaysUntil, formatDate, isOverdue } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { Card, EmptyLine, ErrorLine, KPI, LoadingLine } from './widgets';
import type { AppRol } from '@/types';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
}

export function FullView({ rol }: { rol: AppRol }) {
  const tareasQ = useAllTareas();
  const viajesQ = useAllViajes();
  const firmasQ = useFirmas();
  const pagosQ = usePagos();
  const reintegrosQ = useReintegros();
  const consumosQ = useConsumos();
  const valesQ = useVales();
  const liqsQ = useLiquidaciones();

  const miembrosQ = useQuery({
    queryKey: ['miembros_board', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('miembros_board')
        .select('id, codigo, nombre, orden')
        .order('orden', { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const tareas = tareasQ.data ?? [];
  const pendientes = tareas.filter((t) => !t.done);
  const urgentes = pendientes.filter(
    (t) => t.prioridad === 'alta' || (t.fecha && isOverdue(t.fecha)),
  );
  const hoy = new Date().toISOString().slice(0, 10);
  const hechasHoy = tareas.filter((t) => t.done && t.updated_at?.slice(0, 10) === hoy);

  const viajes = viajesQ.data ?? [];
  const viajesProximos = viajes
    .filter((v) => v.fecha_ini && !isOverdue(v.fecha_ini) && v.estado !== 'cancelado')
    .slice(0, 8);

  const firmas = firmasQ.data ?? [];
  const firmasPendientes = firmas.filter((f) => f.status_firma === 'en_espera');

  const pagos = pagosQ.data ?? [];
  const pagosPorEstado = pagos.reduce<Record<string, number>>((acc, p) => {
    acc[p.estado] = (acc[p.estado] ?? 0) + 1;
    return acc;
  }, {});

  const reintegros = reintegrosQ.data ?? [];
  const reintegrosPendientes = reintegros.filter((r) => r.estado !== 'reintegrada');

  const consumos = consumosQ.data ?? [];
  const consumosSinReintegro = consumos.filter((c) => !c.reintegro_id);

  const vales = valesQ.data ?? [];
  const valesPorEstado = vales.reduce<Record<string, number>>((acc, v) => {
    acc[v.estado] = (acc[v.estado] ?? 0) + 1;
    return acc;
  }, {});

  const liqs = liqsQ.data ?? [];
  const liqsAbiertas = liqs.filter((l) => l.estado !== 'Liquidada' && l.estado !== 'Anulada');

  // Tareas por miembro
  const tareasPorMiembro = new Map<string, { total: number; urgentes: number }>();
  for (const t of pendientes) {
    if (!t.miembro_id) continue;
    const entry = tareasPorMiembro.get(t.miembro_id) ?? { total: 0, urgentes: 0 };
    entry.total += 1;
    if (t.prioridad === 'alta' || (t.fecha && isOverdue(t.fecha))) entry.urgentes += 1;
    tareasPorMiembro.set(t.miembro_id, entry);
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-dark">Dashboard</h1>
        <p className="mt-1 text-sm text-dark-2">
          Resumen completo. Cada widget enlaza a su módulo.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="Tareas urgentes" value={urgentes.length} tone={urgentes.length > 0 ? 'danger' : 'default'} />
        <KPI label="Tareas pendientes" value={pendientes.length} />
        <KPI label="Hechas hoy" value={hechasHoy.length} tone="success" />
        <KPI label="Viajes activos" value={viajesProximos.length} tone={viajesProximos.length > 0 ? 'warn' : 'default'} />
      </div>

      {/* Operación + Finanzas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Miembros del board */}
        <Card title="Miembros del board" className="lg:col-span-3">
          {miembrosQ.isLoading || tareasQ.isLoading ? (
            <LoadingLine />
          ) : miembrosQ.isError ? (
            <ErrorLine message={(miembrosQ.error as Error).message} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {(miembrosQ.data ?? []).map((m) => {
                const stats = tareasPorMiembro.get(m.id) ?? { total: 0, urgentes: 0 };
                return (
                  <Link
                    key={m.id}
                    to={`/${m.codigo.toLowerCase()}`}
                    className="rounded-md border border-sand bg-sand-l/30 p-3 transition-colors hover:border-teal hover:bg-sand-l"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-heading text-base font-bold text-dark">{m.codigo}</span>
                      {stats.urgentes > 0 && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-rust" aria-label="urgente" />
                      )}
                    </div>
                    <div className="mt-1 text-xs text-dark-2 line-clamp-1">{m.nombre}</div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-dark">
                        <strong>{stats.total}</strong> pend.
                      </span>
                      {stats.urgentes > 0 && (
                        <span className="text-rust">
                          <strong>{stats.urgentes}</strong> urg.
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {/* Tareas urgentes */}
        <Card title="Tareas urgentes" className="lg:col-span-2">
          {tareasQ.isLoading ? (
            <LoadingLine />
          ) : tareasQ.isError ? (
            <ErrorLine message={(tareasQ.error as Error).message} />
          ) : urgentes.length === 0 ? (
            <EmptyLine message="Sin tareas urgentes." />
          ) : (
            <ul className="space-y-2">
              {urgentes.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="flex-1">
                    <span className="font-medium text-dark">{t.texto}</span>
                    {t.lista && <span className="ml-2 text-xs text-dark-3">{t.lista}</span>}
                  </span>
                  {t.fecha && (
                    <span className={isOverdue(t.fecha) ? 'text-xs font-semibold text-rust' : 'text-xs text-dark-3'}>
                      {formatDate(t.fecha)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Viajes próximos */}
        <Card title="Viajes próximos">
          {viajesQ.isLoading ? (
            <LoadingLine />
          ) : viajesQ.isError ? (
            <ErrorLine message={(viajesQ.error as Error).message} />
          ) : viajesProximos.length === 0 ? (
            <EmptyLine message="Sin viajes próximos." />
          ) : (
            <ul className="space-y-2">
              {viajesProximos.slice(0, 6).map((v) => {
                const d = v.fecha_ini ? businessDaysUntil(v.fecha_ini) : null;
                return (
                  <li key={v.id} className="text-sm">
                    <div className="font-medium text-dark">{v.destino}</div>
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-3">{v.fecha_ini ? formatDate(v.fecha_ini) : '—'}</span>
                      {d != null && (
                        <span className="text-teal-d">{d > 0 ? `${d}d` : d === 0 ? '¡hoy!' : `hace ${-d}d`}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Firmas pendientes */}
        <Card title="Firmas pendientes" to="/cea">
          {firmasQ.isLoading ? (
            <LoadingLine />
          ) : firmasQ.isError ? (
            <ErrorLine message={(firmasQ.error as Error).message} />
          ) : firmasPendientes.length === 0 ? (
            <EmptyLine message="Sin firmas en espera." />
          ) : (
            <ul className="space-y-2">
              {firmasPendientes.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-dark line-clamp-1">{f.tipo}</span>
                  {f.urgencia === 'urgente' && (
                    <span className="rounded-full bg-rust px-2 py-0.5 text-xs font-semibold text-white">Urg</span>
                  )}
                </li>
              ))}
              {firmasPendientes.length > 6 && (
                <li className="text-xs text-dark-3">+{firmasPendientes.length - 6} más</li>
              )}
            </ul>
          )}
        </Card>

        {/* Pagos por estado */}
        {(rol === 'admin' || rol === 'asistente') && (
          <Card title="Pagos por estado" to="/finanzas">
            {pagosQ.isLoading ? (
              <LoadingLine />
            ) : pagosQ.isError ? (
              <ErrorLine message={(pagosQ.error as Error).message} />
            ) : Object.keys(pagosPorEstado).length === 0 ? (
              <EmptyLine message="Sin pagos." />
            ) : (
              <ul className="space-y-1.5">
                {Object.entries(pagosPorEstado).map(([estado, count]) => (
                  <li key={estado} className="flex items-center justify-between text-sm">
                    <span className="text-dark-2">{estado}</span>
                    <span className="font-mono font-semibold text-dark">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* Reintegros pendientes */}
        {(rol === 'admin' || rol === 'asistente') && (
          <Card title="Reintegros pendientes" to="/finanzas">
            {reintegrosQ.isLoading ? (
              <LoadingLine />
            ) : reintegrosQ.isError ? (
              <ErrorLine message={(reintegrosQ.error as Error).message} />
            ) : reintegrosPendientes.length === 0 ? (
              <EmptyLine message="Todos reintegrados." />
            ) : (
              <ul className="space-y-2">
                {reintegrosPendientes.slice(0, 5).map((r) => (
                  <li key={r.id} className="text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-dark line-clamp-1">{r.empresa}</span>
                      <span className="font-mono text-dark">{fmt(Number(r.monto), r.moneda)}</span>
                    </div>
                    <div className="text-xs text-dark-3">{r.estado}</div>
                  </li>
                ))}
                {reintegrosPendientes.length > 5 && (
                  <li className="text-xs text-dark-3">+{reintegrosPendientes.length - 5} más</li>
                )}
              </ul>
            )}
          </Card>
        )}

        {/* Consumos sin reintegro */}
        {(rol === 'admin' || rol === 'asistente') && (
          <Card title="Consumos TC sin reintegro" to="/finanzas">
            {consumosQ.isLoading ? (
              <LoadingLine />
            ) : consumosQ.isError ? (
              <ErrorLine message={(consumosQ.error as Error).message} />
            ) : consumosSinReintegro.length === 0 ? (
              <EmptyLine message="Todos los consumos tienen reintegro." />
            ) : (
              <ul className="space-y-2">
                {consumosSinReintegro.slice(0, 5).map((c) => (
                  <li key={c.id} className="text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-dark line-clamp-1">{c.proveedor}</span>
                      <span className="font-mono text-dark">{fmt(Number(c.monto), c.moneda)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-dark-3">
                      <span className="font-mono">{c.voucher_num ?? '—'}</span>
                      <span>{formatDate(c.fecha)}</span>
                    </div>
                  </li>
                ))}
                {consumosSinReintegro.length > 5 && (
                  <li className="text-xs text-dark-3">+{consumosSinReintegro.length - 5} más</li>
                )}
              </ul>
            )}
          </Card>
        )}

        {/* Caja chica resumen */}
        {(rol === 'admin' || rol === 'asistente') && (
          <Card title="Caja chica" to="/cc-board" className="lg:col-span-2">
            {valesQ.isLoading || liqsQ.isLoading ? (
              <LoadingLine />
            ) : valesQ.isError ? (
              <ErrorLine message={(valesQ.error as Error).message} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dark-3">Vales por estado</p>
                  {Object.keys(valesPorEstado).length === 0 ? (
                    <EmptyLine message="Sin vales." />
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {Object.entries(valesPorEstado).map(([estado, count]) => (
                        <li key={estado} className="flex justify-between">
                          <span className="text-dark-2">{estado}</span>
                          <span className="font-mono font-semibold text-dark">{count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dark-3">Liquidaciones</p>
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-dark-2">Total</span>
                      <span className="font-mono font-semibold text-dark">{liqs.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-2">Abiertas</span>
                      <span className="font-mono font-semibold text-gold">{liqsAbiertas.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </section>
  );
}
