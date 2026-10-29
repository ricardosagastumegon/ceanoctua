import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * «Pagado con» · las tarjetas del módulo Admin.
 *
 * Devuelve dos cosas y no una: el texto que se ve y el id de la tarjeta. El
 * texto se guarda en `pagado_con` para leerlo de un vistazo; el id va en
 * `pagado_con_id` y es el que suma en la liquidación del viaje.
 *
 * Guardar solo el texto costaba caro: el mismo plástico quedaba escrito de
 * formas distintas según qué campos tuviera llenos la tarjeta, y editarla en
 * Admin dejaba huérfanos los registros viejos. Pasó de verdad el 2026-09-23
 * con la Amex de Guatemala.
 *
 * ── Por qué no es un <select> ──
 *
 * Lo era, y las once tarjetas se veían como once renglones de texto casi
 * iguales: seis terminan en «Miguel A Arriaza» y casi todas dicen «BAC», así
 * que lo único que las distingue --los últimos cuatro dígitos-- quedaba
 * enterrado a media línea. Un `<option>` no admite ni color ni dos renglones.
 * Acá cada tarjeta entra con el color que tiene en Admin, su terminación
 * aparte, y debajo a quién pertenece.
 */

/** Formas de pago que no son una tarjeta del catálogo. */
const OTROS_MEDIOS = ['Transferencia Bancaria', 'Efectivo', 'Otro'] as const;

type Tarjeta = {
  id: string;
  tc_id: string | null;
  tipo: string | null;
  empresa: string | null;
  red: string | null;
  banco: string | null;
  titular: string | null;
  color: string | null;
  activo: boolean;
};

/**
 * El texto que se muestra y se guarda.
 *
 * El `tc_id` va SIEMPRE de primero: la liquidación saca de ahí el nombre
 * corto de una hoja impresa hace meses (`texto.split(' · ')[0]`). Cambiar ese
 * orden reescribiría en silencio lo que dicen los reportes viejos.
 */
export function etiquetaTarjeta(t: Tarjeta): string {
  return [t.tc_id, t.empresa, t.red, t.banco, t.titular].filter(Boolean).join(' · ');
}

/** La terminación, que es lo único que de verdad distingue una tarjeta de otra. */
function terminacion(tcId: string | null): string | null {
  const m = (tcId ?? '').match(/(\d{3,6})\s*$/);
  return m ? m[1] : null;
}

/** A quién pertenece, en una línea. */
function subtitulo(t: Tarjeta): string {
  return t.empresa ?? [t.banco, t.titular].filter(Boolean).join(' · ');
}

function useTarjetas() {
  return useQuery({
    queryKey: ['tarjetas_credito', 'pagado_con'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Tarjeta[]> => {
      const { data, error } = await supabase
        .from('tarjetas_credito')
        .select('id, tc_id, tipo, empresa, red, banco, titular, color, activo');
      if (error) throw error;
      return ((data ?? []) as Tarjeta[]).sort((a, b) =>
        (a.tc_id ?? '').localeCompare(b.tc_id ?? ''),
      );
    },
  });
}

type Props = {
  /** El texto guardado en `pagado_con`. */
  value: string | null | undefined;
  /** El id guardado en `pagado_con_id`, si lo hay. */
  valueId?: string | null;
  onChange: (texto: string, tarjetaId: string | null) => void;
  label?: string;
  id?: string;
};

export function PaymentMethodSelect({ value, valueId, onChange, label, id }: Props) {
  const tarjetas = useTarjetas();
  const filas = tarjetas.data ?? [];
  const [abierto, setAbierto] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [abierto]);

  // El tipo viene del enum `tc_tipo`, que es minúsculo. Compararlo contra
  // 'Presidencia' --como se hacía-- no acertaba nunca, y las siete tarjetas
  // de Presidencia aparecían bajo «Corporativas».
  //
  // Solo se OFRECEN las activas: una tarjeta extraviada y ya repuesta no
  // puede volver a cobrarse nada. Pero se leen todas, porque un servicio
  // guardado con una que acaba de darse de baja tiene que seguir mostrándola.
  const presidencia = useMemo(
    () => filas.filter((t) => t.activo && t.tipo === 'presidencia'),
    [filas],
  );
  const corporativas = useMemo(
    () => filas.filter((t) => t.activo && t.tipo !== 'presidencia'),
    [filas],
  );

  const elegida = valueId ? filas.find((t) => t.id === valueId) ?? null : null;
  const elegidaInactiva = !!elegida && !elegida.activo;

  // Un registro viejo puede traer un texto que ya no corresponde a ninguna
  // opción. Se muestra igual para no borrarlo en silencio al editar.
  const conocido =
    !value ||
    !!valueId ||
    OTROS_MEDIOS.some((o) => o === value) ||
    filas.some((t) => etiquetaTarjeta(t) === value);

  function elegirTarjeta(t: Tarjeta) {
    onChange(etiquetaTarjeta(t), t.id);
    setAbierto(false);
  }

  function elegirTexto(texto: string) {
    onChange(texto, null);
    setAbierto(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
          {label}
        </label>
      )}

      <button
        id={id}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="mt-1 flex w-full items-center gap-2 rounded-md border border-sand bg-white px-3 py-2 text-left text-sm text-dark hover:border-teal focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
      >
        {elegida ? (
          <>
            <Chip color={elegida.color} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold text-dark">
                {elegida.tc_id}
                {elegidaInactiva && (
                  <span className="ml-1.5 rounded bg-rust-l px-1 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-rust">
                    inactiva
                  </span>
                )}
              </span>
              <span className="block truncate text-[11px] text-dark-3">{subtitulo(elegida)}</span>
            </span>
          </>
        ) : (
          <span className={`flex-1 truncate ${value ? 'text-dark' : 'text-dark-3'}`}>
            {value || '— Seleccionar —'}
          </span>
        )}
        <span className="shrink-0 text-[10px] text-dark-3">▼</span>
      </button>

      {abierto && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-sand bg-white shadow-lg">
          {tarjetas.isLoading && <div className="px-3 py-2 text-xs text-dark-3">Cargando tarjetas…</div>}

          <Opcion
            onClick={() => elegirTexto('')}
            seleccionado={!value}
            titulo="— Sin forma de pago —"
          />

          {elegidaInactiva && elegida && (
            <>
              <Grupo titulo="Dada de baja · la que ya estaba guardada" />
              <FilaTarjeta tarjeta={elegida} seleccionado onClick={() => setAbierto(false)} />
            </>
          )}

          {presidencia.length > 0 && <Grupo titulo="Presidencia" />}
          {presidencia.map((t) => (
            <FilaTarjeta
              key={t.id}
              tarjeta={t}
              seleccionado={valueId === t.id}
              onClick={() => elegirTarjeta(t)}
            />
          ))}

          {corporativas.length > 0 && <Grupo titulo="Corporativas" />}
          {corporativas.map((t) => (
            <FilaTarjeta
              key={t.id}
              tarjeta={t}
              seleccionado={valueId === t.id}
              onClick={() => elegirTarjeta(t)}
            />
          ))}

          <Grupo titulo="Otros medios" />
          {OTROS_MEDIOS.map((o) => (
            <Opcion
              key={o}
              onClick={() => elegirTexto(o)}
              seleccionado={!valueId && value === o}
              titulo={o}
            />
          ))}

          {!conocido && value && (
            <Opcion
              onClick={() => elegirTexto(value)}
              seleccionado
              titulo={value}
              nota="sin identificar"
            />
          )}
        </div>
      )}

      {!conocido && value && (
        <p className="mt-1 text-[11px] text-rust">
          Esta forma de pago no está en el catálogo de tarjetas. Escógela de la lista para que
          entre en la liquidación.
        </p>
      )}
    </div>
  );
}

function Chip({ color }: { color: string | null }) {
  return (
    <span
      className="h-7 w-5 shrink-0 rounded-sm border border-black/10"
      style={{ background: `linear-gradient(135deg, ${color ?? '#0d2b2e'}cc, ${color ?? '#0d2b2e'})` }}
    />
  );
}

function Grupo({ titulo }: { titulo: string }) {
  return (
    <div className="border-y border-sand bg-sand-l px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-dark-2">
      {titulo}
    </div>
  );
}

function FilaTarjeta({
  tarjeta,
  seleccionado,
  onClick,
}: {
  tarjeta: Tarjeta;
  seleccionado: boolean;
  onClick: () => void;
}) {
  const term = terminacion(tarjeta.tc_id);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-teal-l ${
        seleccionado ? 'bg-teal-l' : ''
      }`}
    >
      <Chip color={tarjeta.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-dark">{tarjeta.tc_id}</span>
        <span className="block truncate text-[11px] text-dark-3">{subtitulo(tarjeta)}</span>
      </span>
      {term && (
        <span className="shrink-0 rounded bg-sand px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-dark-2">
          ···· {term}
        </span>
      )}
      {seleccionado && <span className="shrink-0 text-xs text-teal-d">✓</span>}
    </button>
  );
}

function Opcion({
  onClick,
  seleccionado,
  titulo,
  nota,
}: {
  onClick: () => void;
  seleccionado: boolean;
  titulo: string;
  nota?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-teal-l ${
        seleccionado ? 'bg-teal-l' : ''
      }`}
    >
      <span className="truncate text-dark-2">{titulo}</span>
      {nota && <span className="shrink-0 text-[10px] text-rust">{nota}</span>}
    </button>
  );
}
