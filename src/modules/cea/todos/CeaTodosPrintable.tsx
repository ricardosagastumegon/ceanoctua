import { formatDate, isOverdue } from '@/lib/dates';
import type { CeaTodo } from './api';

const TEAL = '#077e84';
const TEAL_OSCURO = '#0d2b2e';
const RUST = '#8f3406';

type Props = {
  todos: CeaTodo[];
  /** El nombre de la persona cuando la lista viene filtrada por una. */
  persona?: string | null;
  /** Cómo se llama cada persona, para la columna. */
  nombrePersona: (id: string | null) => string;
};

/**
 * La lista de pendientes, para imprimir o mandar.
 *
 * La usuaria la manda a quien le corresponde, así que la hoja dice **de quién
 * es** en grande cuando viene filtrada por una persona: el que la recibe tiene
 * que reconocer en un segundo que es la suya y no la de otro.
 *
 * Los vencidos salen marcados. Una lista de pendientes sin eso obliga a
 * comparar cada fecha contra el calendario a mano.
 */
export function CeaTodosPrintable({ todos, persona, nombrePersona }: Props) {
  const pendientes = todos.filter((t) => !t.done).length;
  const vencidos = todos.filter((t) => !t.done && t.fecha && isOverdue(t.fecha)).length;
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <article className="text-dark">
      <header className="px-8 py-6 text-white"
        style={{ background: `linear-gradient(135deg,${TEAL_OSCURO} 0%,${TEAL} 58%,#00b4c5 100%)` }}>
        <div className="text-[10px] font-extrabold uppercase tracking-[.22em] text-white/60">
          CEA · Lista de pendientes
        </div>
        <h1 className="mt-1 font-heading text-3xl font-extrabold leading-tight">
          {persona ?? 'Todos los pendientes'}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-white/20 px-3 py-1">{todos.length} en la lista</span>
          <span className="rounded-full bg-white/15 px-3 py-1">{pendientes} sin terminar</span>
          {vencidos > 0 && (
            <span className="rounded-full bg-white/25 px-3 py-1">⚠ {vencidos} vencidos</span>
          )}
          <span className="rounded-full bg-white/10 px-3 py-1">Al {formatDate(hoy)}</span>
        </div>
      </header>

      <section className="px-8 py-5">
        {todos.length === 0 ? (
          <p className="py-4 text-sm italic text-dark-3">No hay pendientes que mostrar.</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left" style={{ backgroundColor: '#d0eced', color: '#055a5f' }}>
                <th className="px-2 py-2 font-extrabold">Asunto</th>
                {/* Sin filtrar hace falta saber de quién es cada uno. */}
                {!persona && <th className="px-2 py-2 font-extrabold">Personal JD</th>}
                <th className="whitespace-nowrap px-2 py-2 font-extrabold">Fecha</th>
                <th className="px-2 py-2 font-extrabold">Prioridad</th>
                <th className="px-2 py-2 font-extrabold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {todos.map((t, i) => {
                const vencido = !t.done && !!t.fecha && isOverdue(t.fecha);
                return (
                  <tr key={t.id} style={{ backgroundColor: i % 2 ? '#ffffff' : 'rgba(0,0,0,.02)' }}>
                    <td className="px-2 py-1.5">
                      <span className={t.done ? 'text-dark-3 line-through' : 'font-semibold text-dark'}>
                        {t.asunto}
                      </span>
                      {t.notas && (
                        <div className="text-[10px] text-dark-3">{t.notas}</div>
                      )}
                    </td>
                    {!persona && (
                      <td className="px-2 py-1.5 text-dark-2">{nombrePersona(t.persona_id)}</td>
                    )}
                    <td className="whitespace-nowrap px-2 py-1.5"
                      style={{ color: vencido ? RUST : undefined, fontWeight: vencido ? 700 : 400 }}>
                      {t.fecha ? formatDate(t.fecha) : '—'}
                      {vencido && ' ⚠'}
                    </td>
                    <td className="px-2 py-1.5 text-dark-2">{t.prioridad_label ?? 'Media'}</td>
                    <td className="px-2 py-1.5 text-dark-2">{t.estado_label ?? 'Comentado'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="px-8 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/40"
        style={{ backgroundColor: TEAL_OSCURO }}>
        CEA · Lista de pendientes · Documento de uso interno
      </div>
    </article>
  );
}
