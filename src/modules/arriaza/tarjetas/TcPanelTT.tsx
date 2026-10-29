import { useMemo, useState } from 'react';
import { useTarjetas, describeError } from '@/modules/admin/hooks';
import {
  anioActual,
  mesActual,
  mesPasado,
  useLiquidacionPeriodo,
  type TarjetaPeriodo,
} from '../viajes/liquidacion-periodo';
import { EstadoCuentaTcModal } from './EstadoCuentaTcModal';
import type { Database } from '@/types/database';

type Tarjeta = Database['public']['Tables']['tarjetas_credito']['Row'];

const money = (v: number) => v.toFixed(2);

/** Totales por moneda: un período puede mover dos y sumarlas sería mentir. */
function totales(t: TarjetaPeriodo | undefined): [string, number][] {
  if (!t) return [];
  const m = new Map<string, number>();
  for (const r of t.renglones) m.set(r.moneda, (m.get(r.moneda) ?? 0) + r.neto);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * Consumos de TC dentro de T&T.
 *
 * La Liquidación por período ya daba estos números, pero había que abrirla y
 * leerla. Acá están a la vista al entrar al módulo: cuánto movió cada plástico
 * en los viajes del período, y un clic abre su estado de cuenta.
 *
 * Se muestran TODAS las tarjetas activas, incluso en cero. Un cero también
 * informa --dice que esa tarjeta no se usó-- mientras que una tarjeta ausente
 * se confunde con un error de captura.
 */
/**
 * Si el panel queda abierto o cerrado, recordado entre visitas.
 *
 * Arranca CERRADO: lo primero de esta pantalla son los viajes, y el consumo
 * por tarjeta se consulta cuando toca pagar, no cada vez que se entra.
 */
const LLAVE_ABIERTO = 'cea.tt.tc-panel';

export function TcPanelTT() {
  const [rango, setRango] = useState(anioActual);
  const [abiertoPanel, setAbiertoPanel] = useState(() => {
    try {
      return localStorage.getItem(LLAVE_ABIERTO) === 'on';
    } catch {
      return false;
    }
  });
  const [abierta, setAbierta] = useState<{ datos: TarjetaPeriodo; tarjeta: Tarjeta | null } | null>(null);
  const tarjetasQ = useTarjetas();
  const periodoQ = useLiquidacionPeriodo(rango.desde, rango.hasta);

  const porId = useMemo(() => {
    const m = new Map<string, TarjetaPeriodo>();
    for (const t of periodoQ.data?.tarjetas ?? []) if (t.tarjetaId) m.set(t.tarjetaId, t);
    return m;
  }, [periodoQ.data]);

  // Una tarjeta dada de baja --extraviada, ya repuesta-- no se puede elegir
  // para cobrar nada nuevo, pero mientras tenga consumos en el período su
  // ficha se queda: ese dinero hay que pagarlo igual. Cuando el período ya no
  // la toca, desaparece sola y se consulta en Finanzas.
  const visibles = useMemo(
    () => (tarjetasQ.data ?? []).filter((t) => t.activo || porId.has(t.id)),
    [tarjetasQ.data, porId],
  );
  const presidencia = visibles.filter((t) => t.tipo === 'presidencia');
  const corporativas = visibles.filter((t) => t.tipo !== 'presidencia');

  // Lo que se pagó con algo que no quedó amarrado al catálogo. Si no se
  // mostrara, ese dinero desaparecería de la vista sin que nadie se entere.
  const sinIdentificar = useMemo(
    () => (periodoQ.data?.tarjetas ?? []).filter((t) => !t.tarjetaId && t.renglones.length > 0),
    [periodoQ.data],
  );

  const vacio =
    !periodoQ.isLoading && !periodoQ.isError && (periodoQ.data?.renglones.length ?? 0) === 0;

  function alternar() {
    const v = !abiertoPanel;
    setAbiertoPanel(v);
    try {
      localStorage.setItem(LLAVE_ABIERTO, v ? 'on' : 'off');
    } catch {
      // Sin localStorage el panel no recuerda; no es motivo para romper la
      // pantalla.
    }
  }

  return (
    <section className="rounded-card border border-sand bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={abiertoPanel}
          className="flex items-start gap-2 text-left"
        >
          <span className="mt-1 text-xs text-dark-3">{abiertoPanel ? '▾' : '▸'}</span>
          <span>
            <span className="block font-heading text-base font-extrabold text-dark">
              💳 Consumos de TC
            </span>
            <span className="block text-[11px] text-dark-3">
              {abiertoPanel
                ? 'Lo que cada tarjeta movió en los viajes del período. Un clic abre su estado de cuenta.'
                : 'Lo que cada tarjeta movió en los viajes. Clic para verlo.'}
            </span>
          </span>
        </button>

        {!abiertoPanel && (
          <button
            type="button"
            onClick={alternar}
            className="ml-auto rounded-md border border-sand px-3 py-1.5 text-[11px] font-semibold text-dark-2 hover:border-teal hover:text-teal"
          >
            Mostrar
          </button>
        )}

        {abiertoPanel && (
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {([
            ['Mes actual', mesActual],
            ['Mes pasado', mesPasado],
            ['Año', anioActual],
          ] as const).map(([rotulo, fn]) => (
            <button
              key={rotulo}
              type="button"
              onClick={() => setRango(fn())}
              className="rounded-md border border-sand bg-white px-2.5 py-1.5 text-[11px] font-semibold text-dark-2 hover:border-teal hover:text-teal"
            >
              {rotulo}
            </button>
          ))}
          <input
            type="date"
            value={rango.desde}
            onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
            className="rounded-md border border-sand bg-white px-2 py-1.5 text-[11px] text-dark focus:border-teal focus:outline-none"
            aria-label="Desde"
          />
          <input
            type="date"
            value={rango.hasta}
            onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
            className="rounded-md border border-sand bg-white px-2 py-1.5 text-[11px] text-dark focus:border-teal focus:outline-none"
            aria-label="Hasta"
          />
          <button
            type="button"
            onClick={alternar}
            className="rounded-md border border-sand px-3 py-1.5 text-[11px] font-semibold text-dark-2 hover:border-teal hover:text-teal"
          >
            Ocultar
          </button>
        </div>
        )}
      </div>

      {!abiertoPanel ? null : (
      <div className="mt-3">

      {periodoQ.isError && (
        <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-xs text-rust">
          {describeError(periodoQ.error)}
        </div>
      )}
      {periodoQ.isLoading && <p className="text-xs text-dark-3">Sumando los viajes del período…</p>}
      {vacio && (
        <p className="text-xs italic text-dark-3">
          Ninguna tarjeta se movió en este período.
        </p>
      )}

      {presidencia.length > 0 && (
        <>
          <Rotulo>Tarjetas de Presidencia</Rotulo>
          <div className="flex flex-wrap gap-3">
            {presidencia.map((t) => (
              <Ficha
                key={t.id}
                tarjeta={t}
                datos={porId.get(t.id)}
                onAbrir={(datos) => setAbierta({ datos, tarjeta: t })}
              />
            ))}
          </div>
        </>
      )}

      {corporativas.length > 0 && (
        <>
          <Rotulo>Tarjetas corporativas</Rotulo>
          <div className="flex flex-wrap gap-3">
            {corporativas.map((t) => (
              <Ficha
                key={t.id}
                tarjeta={t}
                datos={porId.get(t.id)}
                onAbrir={(datos) => setAbierta({ datos, tarjeta: t })}
              />
            ))}
          </div>
        </>
      )}

      {sinIdentificar.length > 0 && (
        <>
          <Rotulo>Sin identificar</Rotulo>
          <p className="mb-2 text-[11px] text-rust">
            Pagos que no quedaron amarrados a una tarjeta del catálogo. Ábrelos y corrige la forma
            de pago en el servicio para que entren donde corresponde.
          </p>
          <div className="flex flex-wrap gap-3">
            {sinIdentificar.map((d) => (
              <article key={d.etiqueta} className="w-52 overflow-hidden rounded-card border border-rust/40">
                <button
                  type="button"
                  onClick={() => setAbierta({ datos: d, tarjeta: null })}
                  className="w-full p-3 text-left text-white"
                  style={{ background: 'linear-gradient(135deg,#a8643f,#8f3406)' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
                    Sin identificar
                  </p>
                  <p className="mt-1.5 truncate font-mono text-sm font-extrabold">
                    {d.etiqueta || 'Sin forma de pago'}
                  </p>
                </button>
                <Pie datos={d} />
              </article>
            ))}
          </div>
        </>
      )}

      </div>
      )}

      {abierta && (
        <EstadoCuentaTcModal
          open
          onClose={() => setAbierta(null)}
          tarjeta={abierta.datos}
          color={abierta.tarjeta?.color}
          subtitulo={
            abierta.tarjeta
              ? abierta.tarjeta.empresa ??
                [abierta.tarjeta.banco, abierta.tarjeta.titular].filter(Boolean).join(' · ')
              : null
          }
          desde={rango.desde}
          hasta={rango.hasta}
        />
      )}
    </section>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-3 text-[10px] font-extrabold uppercase tracking-wider text-dark-2">
      {children}
    </h3>
  );
}

function Ficha({
  tarjeta,
  datos,
  onAbrir,
}: {
  tarjeta: Tarjeta;
  datos: TarjetaPeriodo | undefined;
  onAbrir: (datos: TarjetaPeriodo) => void;
}) {
  const tinte = tarjeta.color ?? '#0d2b2e';
  // Misma ficha que la galería de Finanzas: arriba de quién es la tarjeta,
  // en medio su identificador y abajo el banco.
  const duenio = tarjeta.empresa ?? tarjeta.titular ?? tarjeta.banco;
  const movido = (datos?.renglones.length ?? 0) > 0;
  // Una tarjeta sin movimiento necesita un objeto igual para abrir su hoja:
  // la hoja en blanco dice "no movió nada", que es informacion.
  const vacia: TarjetaPeriodo = {
    tarjetaId: tarjeta.id,
    etiqueta: tarjeta.tc_id ?? '—',
    identificada: true,
    cargos: 0,
    reintegros: 0,
    neto: 0,
    renglones: [],
    viajes: [],
  };

  return (
    <article
      className={`flex w-52 flex-col overflow-hidden rounded-card border shadow-sm transition-transform hover:scale-[1.02] ${
        movido ? 'border-sand' : 'border-sand opacity-70'
      }`}
    >
      <button
        type="button"
        onClick={() => onAbrir(datos ?? vacia)}
        className="p-3 text-left text-white"
        style={{ background: `linear-gradient(135deg, ${tinte}cc, ${tinte})` }}
        title="Ver el estado de cuenta de esta tarjeta"
      >
        <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.14em] opacity-95">
          {duenio || 'Tarjeta'}
        </p>
        <p className="mt-1.5 break-words font-mono text-sm font-extrabold leading-tight">
          {tarjeta.tc_id}
        </p>
        {tarjeta.banco && tarjeta.banco !== duenio && (
          <p className="mt-1 truncate text-[10px] opacity-80">{tarjeta.banco}</p>
        )}
        {!tarjeta.activo && (
          <p className="mt-1 inline-block rounded bg-white/25 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider">
            Dada de baja
          </p>
        )}
      </button>
      <Pie datos={datos} />
    </article>
  );
}

function Pie({ datos }: { datos: TarjetaPeriodo | undefined }) {
  const n = datos?.renglones.length ?? 0;
  const sumas = totales(datos);
  return (
    <div className="bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">
        {n} servicio{n === 1 ? '' : 's'}
      </p>
      {sumas.length === 0 ? (
        <p className="mt-0.5 font-mono text-xs text-dark-3">sin movimiento</p>
      ) : (
        <ul className="mt-0.5 space-y-0.5">
          {sumas.map(([m, v]) => (
            <li key={m} className="font-mono text-xs font-extrabold text-dark">
              {m} {money(v)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
