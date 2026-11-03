import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useFirmarDocumento, useFirmas } from '@/modules/cea/firmas/hooks';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { usePagos } from '@/modules/finanzas/pagos/hooks';
import { useCeaTodos } from '@/modules/cea/todos/hooks';
import { useAttViajes } from '@/modules/arriaza/viajes/hooks';
import { formatMoney } from '@/lib/money';

/**
 * El tablero de quien firma y supervisa.
 *
 * No es el tablero completo con una columna menos: es otro tablero. Quien
 * entra acá no opera el sistema —no captura vales ni arma viajes—, así que
 * los indicadores de operación le estorban. Lo que necesita es:
 *
 *   1. Qué espera su firma, que es su trabajo.
 *   2. Qué está pendiente del equipo.
 *   3. Qué viajes vienen.
 *
 * En ese orden, y pensado primero para el teléfono: una columna, bloques
 * grandes, nada que necesite apuntar con precisión.
 */

const PESO_URGENCIA: Record<string, number> = { urgente: 0, importante: 1, programado: 2 };
const PESO_PRIORIDAD: Record<string, number> = { alta: 0, media: 1, baja: 2 };

const TONO_URGENCIA: Record<string, string> = {
  urgente: 'bg-rust text-white',
  importante: 'bg-gold text-white',
  programado: 'bg-sand text-dark-2',
};

const TONO_PRIORIDAD: Record<string, string> = {
  alta: 'bg-rust-l text-rust',
  media: 'bg-gold-light text-gold',
  baja: 'bg-sand text-dark-2',
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Una fecha legible, o nada.
 *
 * Hay registros con el año mal tecleado --20266-- que ordenan al final de
 * todo y se leen como un error. Se tratan como si no tuvieran fecha en vez de
 * mostrar un disparate.
 */
function dia(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  const a = d.getFullYear();
  if (a < 2000 || a > 2100) return null;
  return `${d.getDate()} ${MESES[d.getMonth()]}${a === new Date().getFullYear() ? '' : ` ${a}`}`;
}

/** Días desde (negativo) o hasta (positivo) una fecha. */
function enDias(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  const a = d.getFullYear();
  if (a < 2000 || a > 2100) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
}

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function money(n: number, moneda: string | null): string {
  if (!moneda || moneda === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: moneda }).format(Number(n));
}

export function GerenteView() {
  const { profile } = useAuth();
  const firmasQ = useFirmas();
  const pagosQ = usePagos();
  const todosQ = useCeaTodos();
  const viajesQ = useAttViajes();
  const firmar = useFirmarDocumento();
  const toast = useToast();
  const confirm = useConfirm();

  /**
   * Firmar desde aquí, sin ir a buscar el documento a otra pantalla. Se
   * pregunta antes: queda registrado con su nombre y la fecha.
   */
  async function firmarDocumento(id: string, titulo: string) {
    const ok = await confirm({
      title: 'Firmar documento',
      message: (
        <>
          ¿Dar por firmado <strong>{titulo}</strong>? Queda registrado con tu nombre y la fecha
          de hoy.
        </>
      ),
      confirmLabel: 'Firmar',
    });
    if (!ok) return;
    try {
      await firmar.mutateAsync(id);
      toast.success('Documento firmado.');
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  const porPago = new Map((pagosQ.data ?? []).map((p) => [p.id, p]));

  const enEspera = (firmasQ.data ?? [])
    .filter((f) => f.status_firma === 'en_espera')
    .sort(
      (a, b) =>
        (PESO_URGENCIA[a.urgencia ?? 'programado'] ?? 2) -
          (PESO_URGENCIA[b.urgencia ?? 'programado'] ?? 2) ||
        (a.recepcion ?? '').localeCompare(b.recepcion ?? ''),
    );

  // Digital es la que nació dentro del sistema --la disparó alguien desde una
  // solicitud de pago o una liquidación-- y física es el papel que trajeron a
  // la oficina y se registró a mano. Es un dato de la firma, no algo que se
  // deduzca de si tiene pago.
  const digitales = enEspera.filter((f) => f.origen === 'digital');
  const fisicas = enEspera.filter((f) => f.origen !== 'digital');

  const pendientes = (todosQ.data ?? [])
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        (PESO_PRIORIDAD[a.prioridad ?? 'media'] ?? 1) -
          (PESO_PRIORIDAD[b.prioridad ?? 'media'] ?? 1) ||
        (a.fecha ?? '').localeCompare(b.fecha ?? ''),
    );

  const hoy = new Date().toISOString().slice(0, 10);
  const viajes = (viajesQ.data ?? [])
    .filter((v) => (v.fecha_fin ?? v.fecha_ini ?? '') >= hoy)
    .sort((a, b) => (a.fecha_ini ?? '').localeCompare(b.fecha_ini ?? ''))
    .slice(0, 4);

  return (
    <section className="space-y-5">
      {/* ── Saludo ───────────────────────────────────────────────────── */}
      <header
        className="rounded-card px-5 py-6 text-white shadow-sm sm:px-7"
        style={{ background: 'linear-gradient(135deg,#0d2b2e 0%,#077e84 55%,#00b4c5 100%)' }}
      >
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/60">
          CEA · Board Assistant
        </p>
        <h1 className="mt-1 font-heading text-2xl font-extrabold leading-tight sm:text-3xl">
          {saludo()}
          {profile?.nombre ? `, ${profile.nombre.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {enEspera.length === 0
            ? 'No tienes documentos esperando tu firma.'
            : `Tienes ${enEspera.length} ${enEspera.length === 1 ? 'documento' : 'documentos'} esperando tu firma.`}
        </p>
      </header>

      {/* ── Firmas ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloque
          titulo="Firmas digitales"
          bajada="Enviadas desde el sistema por el equipo"
          icono="💻"
          cuenta={digitales.length}
          color="#077e84"
          verMas="/cea"
          cargando={firmasQ.isLoading}
          vacio="Nadie te ha enviado documentos para firmar."
        >
          {digitales.map((f) => {
            const pago = f.pago_id ? porPago.get(f.pago_id) : undefined;
            const espera = enDias(f.recepcion);
            return (
              <Renglon
                key={f.id}
                etiqueta={f.urgencia ?? 'programado'}
                tono={TONO_URGENCIA[f.urgencia ?? 'programado'] ?? TONO_URGENCIA.programado}
                titulo={f.tipo}
                detalle={[pago?.proveedor ?? f.solicitado, f.justificacion]
                  .filter(Boolean)
                  .join(' · ')}
                cifra={pago ? money(Number(pago.monto), pago.moneda) : null}
                pie={
                  espera != null && espera <= -3
                    ? `${Math.abs(espera)} días esperando`
                    : dia(f.recepcion)
                }
                alerta={espera != null && espera <= -3}
                accion={
                  <BotonFirmar onClick={() => void firmarDocumento(f.id, f.tipo)} />
                }
              />
            );
          })}
        </Bloque>

        <Bloque
          titulo="Firmas físicas"
          bajada="Documentos en papel registrados a mano"
          icono="📄"
          cuenta={fisicas.length}
          color="#9e7a1a"
          verMas="/cea"
          cargando={firmasQ.isLoading}
          vacio="Sin documentos en papel pendientes."
        >
          {fisicas.map((f) => {
            const espera = enDias(f.recepcion);
            return (
              <Renglon
                key={f.id}
                etiqueta={f.urgencia ?? 'programado'}
                tono={TONO_URGENCIA[f.urgencia ?? 'programado'] ?? TONO_URGENCIA.programado}
                titulo={f.tipo}
                detalle={[f.solicitado, f.justificacion].filter(Boolean).join(' · ')}
                cifra={null}
                pie={
                  espera != null && espera <= -3
                    ? `${Math.abs(espera)} días esperando`
                    : dia(f.recepcion)
                }
                alerta={espera != null && espera <= -3}
                accion={
                  <BotonFirmar onClick={() => void firmarDocumento(f.id, f.tipo)} />
                }
              />
            );
          })}
        </Bloque>
      </div>

      {/* ── Tareas ───────────────────────────────────────────────────── */}
      <Bloque
        titulo="Tareas pendientes"
        bajada="Del tablero de to-dos de CEA"
        icono="✅"
        cuenta={pendientes.length}
        color="#bf4609"
        verMas="/cea"
        cargando={todosQ.isLoading}
        vacio="No hay tareas pendientes."
      >
        {pendientes.slice(0, 8).map((t) => {
          const faltan = enDias(t.fecha);
          return (
            <Renglon
              key={t.id}
              etiqueta={t.prioridad ?? 'media'}
              tono={TONO_PRIORIDAD[t.prioridad ?? 'media'] ?? TONO_PRIORIDAD.media}
              titulo={t.asunto}
              detalle={[t.responsable, t.estado_label ?? t.estado].filter(Boolean).join(' · ')}
              cifra={null}
              pie={
                faltan != null && faltan < 0
                  ? `Venció hace ${Math.abs(faltan)} ${Math.abs(faltan) === 1 ? 'día' : 'días'}`
                  : faltan === 0
                    ? 'Es hoy'
                    : dia(t.fecha)
              }
              alerta={faltan != null && faltan <= 0}
            />
          );
        })}
        {pendientes.length > 8 && (
          <p className="px-1 pt-1 text-[11px] text-dark-3">
            y {pendientes.length - 8} más en CEA → To-dos
          </p>
        )}
      </Bloque>

      {/* ── Viajes ───────────────────────────────────────────────────── */}
      <section className="rounded-card border border-sand bg-white p-4 shadow-sm sm:p-5">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-base font-extrabold text-dark">✈️ Próximos viajes</h2>
            <p className="text-[11px] text-dark-3">Información que quizá te interese</p>
          </div>
          <Link to="/arriaza" className="shrink-0 text-xs font-extrabold text-teal-d hover:underline">
            Ver todos →
          </Link>
        </header>

        {viajesQ.isLoading ? (
          <p className="text-xs text-dark-3">Cargando…</p>
        ) : viajes.length === 0 ? (
          <p className="text-sm italic text-dark-3">Sin viajes próximos.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {viajes.map((v) => {
              const faltan = enDias(v.fecha_ini);
              return (
                <li
                  key={v.id}
                  className="overflow-hidden rounded-lg border border-sand bg-sand-l/40"
                >
                  <div
                    className="px-3 py-2 text-white"
                    style={{ background: 'linear-gradient(135deg,#0d2b2e,#077e84)' }}
                  >
                    <p className="truncate text-sm font-extrabold">{v.titulo}</p>
                    <p className="truncate text-[11px] text-white/75">
                      {[v.destino, v.pais].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="space-y-1 px-3 py-2">
                    <p className="text-xs font-bold text-dark">
                      {dia(v.fecha_ini)} — {dia(v.fecha_fin)}
                      {faltan != null && faltan > 0 && (
                        <span className="ml-1.5 font-normal text-dark-3">
                          (en {faltan} {faltan === 1 ? 'día' : 'días'})
                        </span>
                      )}
                      {faltan != null && faltan <= 0 && (
                        <span className="ml-1.5 font-extrabold text-teal-d">en curso</span>
                      )}
                    </p>
                    {v.acompanantes && (
                      <p className="text-[11px] leading-snug text-dark-2">
                        <span className="font-semibold text-dark-3">Participantes: </span>
                        {v.acompanantes}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

/** Bloque con encabezado, contador y lista. */
function Bloque({
  titulo,
  bajada,
  icono,
  cuenta,
  color,
  verMas,
  cargando,
  vacio,
  children,
}: {
  titulo: string;
  bajada: string;
  icono: string;
  cuenta: number;
  color: string;
  verMas: string;
  cargando: boolean;
  vacio: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-sand bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-extrabold text-dark">
            {icono} {titulo}
          </h2>
          <p className="text-[11px] text-dark-3">{bajada}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="font-heading text-2xl font-extrabold leading-none"
            style={{ color: cuenta > 0 ? color : '#9a8f86' }}
          >
            {cuenta}
          </span>
          <Link
            to={verMas}
            className="shrink-0 rounded-md border border-teal/40 px-2 py-1 text-[11px] font-extrabold text-teal-d hover:bg-teal-l"
          >
            Ver todas →
          </Link>
        </div>
      </header>

      {cargando ? (
        <p className="text-xs text-dark-3">Cargando…</p>
      ) : cuenta === 0 ? (
        <p className="text-sm italic text-dark-3">{vacio}</p>
      ) : (
        <ul className="space-y-1.5">{children}</ul>
      )}
    </section>
  );
}

/**
 * El botón de firmar.
 *
 * Grande a propósito: se usa desde el teléfono y con el pulgar. Es la acción
 * por la que esta persona entra a la aplicación.
 */
function BotonFirmar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md bg-teal px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-teal-d"
    >
      ✍️ Firmar
    </button>
  );
}

/** Un renglón de cualquiera de las listas. */
function Renglon({
  etiqueta,
  tono,
  titulo,
  detalle,
  cifra,
  pie,
  alerta,
  accion,
}: {
  etiqueta: string;
  tono: string;
  titulo: string;
  detalle: string;
  cifra: string | null;
  pie: string | null;
  alerta: boolean;
  accion?: React.ReactNode;
}) {
  return (
    <li className="rounded-md border border-sand bg-sand-l/30 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${tono}`}
        >
          {etiqueta}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-dark">{titulo}</span>
        {cifra && (
          <span className="shrink-0 font-mono text-sm font-extrabold text-dark">{cifra}</span>
        )}
      </div>
      {detalle && <p className="mt-0.5 line-clamp-2 text-[11px] text-dark-3">{detalle}</p>}
      <div className="mt-1 flex items-end justify-between gap-2">
        {pie ? (
          <p className={`text-[10px] ${alerta ? 'font-extrabold text-rust' : 'text-dark-3'}`}>
            {pie}
          </p>
        ) : (
          <span />
        )}
        {accion}
      </div>
    </li>
  );
}
