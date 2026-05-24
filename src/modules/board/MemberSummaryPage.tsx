import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTareas } from './tareas/hooks';
import { useViajes } from './viajes/hooks';
import { useEventos } from './eventos/hooks';
import { useNotas } from './notas/hooks';
import { businessDaysUntil, formatDate, isOverdue } from '@/lib/dates';
import { Card, EmptyLine, ErrorLine, KPI, LoadingLine } from '@/modules/dashboard/widgets';

type Props = { codigo: string };

export function MemberSummaryPage({ codigo }: Props) {
  const { profile } = useAuth();

  const miembroQuery = useQuery({
    queryKey: ['miembros_board', 'by-codigo', codigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('miembros_board')
        .select('id, codigo, nombre, rol, color')
        .eq('codigo', codigo)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const miembroId = miembroQuery.data?.id;
  const tareasQ = useTareas(miembroId);
  const viajesQ = useViajes(miembroId);
  const eventosQ = useEventos(miembroId);
  const notasQ = useNotas(miembroId);

  if (miembroQuery.isLoading) {
    return <p className="text-sm text-dark-3">Cargando miembro…</p>;
  }

  if (miembroQuery.isError) {
    return (
      <p className="text-sm text-rust">
        Error al cargar el miembro: {String((miembroQuery.error as Error)?.message)}
      </p>
    );
  }

  const miembro = miembroQuery.data;
  if (!miembro) {
    return (
      <section className="rounded-card border border-sand bg-white p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-semibold text-dark">Miembro no encontrado</h1>
        <p className="mt-2 text-sm text-dark-2">
          No existe un miembro con código <code>{codigo}</code> en la tabla{' '}
          <code>miembros_board</code>.
        </p>
      </section>
    );
  }

  const tareas = tareasQ.data ?? [];
  const pendientes = tareas.filter((t) => !t.done);
  const urgentes = pendientes.filter(
    (t) => t.prioridad === 'alta' || (t.fecha && isOverdue(t.fecha)),
  );
  const hoy = new Date().toISOString().slice(0, 10);
  const completadasHoy = tareas.filter(
    (t) => t.done && t.updated_at?.slice(0, 10) === hoy,
  );

  const viajes = viajesQ.data ?? [];
  const viajesProximos = viajes
    .filter((v) => v.fecha_ini && !isOverdue(v.fecha_ini) && v.estado !== 'cancelado')
    .slice(0, 6);

  const eventos = eventosQ.data ?? [];
  const eventosProximos = eventos
    .filter((e) => e.fecha && new Date(e.fecha) >= new Date(hoy))
    .slice(0, 6);

  const notas = notasQ.data ?? [];
  const notasRecientes = notas.slice(0, 3);

  const canEdit =
    profile?.rol === 'admin' ||
    profile?.rol === 'asistente' ||
    (profile?.rol === 'board_member' && profile.miembro_codigo === codigo);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-dark">
            {miembro.nombre}
            <span className="ml-2 text-base font-medium text-dark-3">({miembro.codigo})</span>
          </h1>
          {miembro.rol && <p className="mt-1 text-sm text-dark-2">{miembro.rol}</p>}
          <p className="mt-1 text-xs text-dark-3">
            Resumen de lo asignado a este miembro. La gestión global (crear / editar / borrar tareas, viajes, eventos, notas) se hace desde sus módulos correspondientes.
          </p>
        </div>
        {!canEdit && (
          <span className="rounded-full bg-sand-l px-3 py-1 text-xs font-semibold uppercase tracking-wider text-dark-3">
            Solo lectura
          </span>
        )}
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI
          label="Urgentes"
          value={urgentes.length}
          tone={urgentes.length > 0 ? 'danger' : 'default'}
          hint="prio alta o vencidas"
        />
        <KPI label="Pendientes" value={pendientes.length} />
        <KPI label="Hechas hoy" value={completadasHoy.length} tone="success" />
        <KPI
          label="Viajes próximos"
          value={viajesProximos.length}
          tone={viajesProximos.length > 0 ? 'warn' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Tareas urgentes">
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

        <Card title="Pendientes (todas)">
          {tareasQ.isLoading ? (
            <LoadingLine />
          ) : pendientes.length === 0 ? (
            <EmptyLine message="Sin pendientes 🎉" />
          ) : (
            <ul className="space-y-2">
              {pendientes.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="flex-1">
                    <span className="font-medium text-dark">{t.texto}</span>
                    {t.prioridad && (
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${prioBg(t.prioridad)}`}>
                        {t.prioridad}
                      </span>
                    )}
                  </span>
                  {t.fecha && <span className="text-xs text-dark-3">{formatDate(t.fecha)}</span>}
                </li>
              ))}
              {pendientes.length > 8 && (
                <li className="text-xs text-dark-3">+{pendientes.length - 8} más</li>
              )}
            </ul>
          )}
        </Card>

        <Card title="Viajes próximos">
          {viajesQ.isLoading ? (
            <LoadingLine />
          ) : viajesProximos.length === 0 ? (
            <EmptyLine message="Sin viajes programados." />
          ) : (
            <ul className="space-y-2">
              {viajesProximos.map((v) => {
                const d = v.fecha_ini ? businessDaysUntil(v.fecha_ini) : null;
                return (
                  <li key={v.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex-1">
                      <span className="font-medium text-dark">{v.destino}</span>
                      {v.fecha_ini && <span className="ml-2 text-xs text-dark-3">{formatDate(v.fecha_ini)}</span>}
                    </span>
                    {d != null && (
                      <span className="text-xs text-teal-d">
                        {d > 0 ? `${d}d hábiles` : d === 0 ? '¡hoy!' : `hace ${-d}d`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Próximos eventos">
          {eventosQ.isLoading ? (
            <LoadingLine />
          ) : eventosProximos.length === 0 ? (
            <EmptyLine message="Sin eventos programados." />
          ) : (
            <ul className="space-y-2">
              {eventosProximos.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="flex-1">
                    <span className="font-medium text-dark">{e.titulo}</span>
                    {e.lugar && <span className="ml-2 text-xs text-dark-3">· {e.lugar}</span>}
                  </span>
                  {e.fecha && <span className="text-xs text-dark-3">{formatDate(e.fecha)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Notas recientes" className="lg:col-span-2">
          {notasQ.isLoading ? (
            <LoadingLine />
          ) : notasRecientes.length === 0 ? (
            <EmptyLine message="Sin notas registradas." />
          ) : (
            <ul className="space-y-3">
              {notasRecientes.map((n) => (
                <li key={n.id} className="rounded-md border border-sand bg-sand-l/30 p-3">
                  {n.titulo && <p className="font-semibold text-dark">{n.titulo}</p>}
                  <p className="line-clamp-3 whitespace-pre-line text-sm text-dark-2">{n.contenido}</p>
                  <p className="mt-1 text-[11px] text-dark-3">{formatDate(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Gestión global" className="lg:col-span-2">
          <p className="mb-3 text-sm text-dark-2">
            Crea o edita tareas, viajes, eventos y notas asignadas a {miembro.nombre} desde sus módulos:
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="inline-flex items-center rounded-md border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal-d hover:bg-teal-l">
              ← Dashboard
            </Link>
            <Link to="/cea" className="inline-flex items-center rounded-md border border-sand px-3 py-1.5 text-xs font-semibold text-dark-2 hover:bg-sand-l">
              CEA · To-dos / Firmas
            </Link>
            <Link to="/finanzas" className="inline-flex items-center rounded-md border border-sand px-3 py-1.5 text-xs font-semibold text-dark-2 hover:bg-sand-l">
              Finanzas
            </Link>
            <Link to="/cc-board" className="inline-flex items-center rounded-md border border-sand px-3 py-1.5 text-xs font-semibold text-dark-2 hover:bg-sand-l">
              CC Board
            </Link>
          </div>
        </Card>
      </div>
    </section>
  );
}

function prioBg(p: string): string {
  if (p === 'alta') return 'bg-rust-l text-rust';
  if (p === 'media') return 'bg-gold-light text-gold';
  return 'bg-sand text-dark-2';
}
