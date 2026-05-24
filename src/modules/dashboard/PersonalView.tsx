import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useTareas } from '@/modules/board/tareas/hooks';
import { useViajes } from '@/modules/board/viajes/hooks';
import { useEventos } from '@/modules/board/eventos/hooks';
import { businessDaysUntil, formatDate, isOverdue } from '@/lib/dates';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, EmptyLine, ErrorLine, KPI, LoadingLine } from './widgets';
import { DashboardHero } from './DashboardHero';

export function PersonalView({ memberCode }: { memberCode: string }) {
  const { profile } = useAuth();
  const memberIdQuery = useQuery({
    queryKey: ['miembros_board', 'by-codigo', memberCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('miembros_board')
        .select('id, nombre')
        .eq('codigo', memberCode)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const memberId = memberIdQuery.data?.id;

  const tareasQ = useTareas(memberId);
  const viajesQ = useViajes(memberId);
  const eventosQ = useEventos(memberId);

  const tareas = tareasQ.data ?? [];
  const pendientes = tareas.filter((t) => !t.done);
  const urgentes = pendientes.filter(
    (t) => t.prioridad === 'alta' || (t.fecha && isOverdue(t.fecha)),
  );
  const completadasHoy = tareas.filter(
    (t) => t.done && t.updated_at && t.updated_at.slice(0, 10) === new Date().toISOString().slice(0, 10),
  );

  const viajes = viajesQ.data ?? [];
  const proximos = viajes
    .filter((v) => v.fecha_ini && !isOverdue(v.fecha_ini) && v.estado !== 'cancelado')
    .slice(0, 5);

  const eventos = eventosQ.data ?? [];
  const proximosEventos = eventos
    .filter((e) => e.fecha && new Date(e.fecha) >= new Date())
    .slice(0, 5);

  const memberPath = `/${memberCode.toLowerCase()}`;

  return (
    <section className="space-y-6">
      <DashboardHero userName={profile?.nombre} activeTripsCount={proximos.length} />
      <header>
        <h1 className="font-heading text-2xl font-semibold text-dark">
          Tu resumen como miembro <strong className="text-teal-d">{memberCode}</strong>
        </h1>
        <p className="mt-1 text-sm text-dark-2">
          Lo asignado a {memberIdQuery.data?.nombre ?? memberCode}.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="Urgentes" value={urgentes.length} tone={urgentes.length > 0 ? 'danger' : 'default'} hint="prio alta o vencidas" />
        <KPI label="Pendientes" value={pendientes.length} />
        <KPI label="Hechas hoy" value={completadasHoy.length} tone="success" />
        <KPI label="Viajes próximos" value={proximos.length} tone={proximos.length > 0 ? 'warn' : 'default'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Tareas urgentes" to={memberPath}>
          {tareasQ.isLoading ? (
            <LoadingLine />
          ) : tareasQ.isError ? (
            <ErrorLine message={(tareasQ.error as Error).message} />
          ) : urgentes.length === 0 ? (
            <EmptyLine message="Sin tareas urgentes." />
          ) : (
            <ul className="space-y-2">
              {urgentes.slice(0, 6).map((t) => (
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

        <Card title="Viajes próximos" to={memberPath}>
          {viajesQ.isLoading ? (
            <LoadingLine />
          ) : viajesQ.isError ? (
            <ErrorLine message={(viajesQ.error as Error).message} />
          ) : proximos.length === 0 ? (
            <EmptyLine message="Sin viajes programados." />
          ) : (
            <ul className="space-y-2">
              {proximos.map((v) => {
                const d = v.fecha_ini ? businessDaysUntil(v.fecha_ini) : null;
                return (
                  <li key={v.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex-1">
                      <span className="font-medium text-dark">{v.destino}</span>
                      {v.fecha_ini && <span className="ml-2 text-xs text-dark-3">{formatDate(v.fecha_ini)}</span>}
                    </span>
                    {d != null && (
                      <span className="text-xs text-teal-d">{d > 0 ? `${d} días hábiles` : d === 0 ? '¡hoy!' : `hace ${-d}d`}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Próximos eventos" to={memberPath} className="lg:col-span-2">
          {eventosQ.isLoading ? (
            <LoadingLine />
          ) : eventosQ.isError ? (
            <ErrorLine message={(eventosQ.error as Error).message} />
          ) : proximosEventos.length === 0 ? (
            <EmptyLine message="Sin eventos programados." />
          ) : (
            <ul className="space-y-2">
              {proximosEventos.map((e) => (
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

        <Card title="Ir a mi página" className="lg:col-span-2">
          <Link
            to={memberPath}
            className="inline-flex items-center rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d"
          >
            Abrir mi sección {memberCode} →
          </Link>
        </Card>
      </div>
    </section>
  );
}
