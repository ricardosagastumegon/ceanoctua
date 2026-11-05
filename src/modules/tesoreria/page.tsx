import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  BotonPrincipal,
  Bloque,
  Cabecera,
  Renglon,
  dia,
  enDias,
  money,
} from '@/modules/dashboard/tablero';
import {
  DOC_TIPO_LABEL,
  ENVIOS_KEY,
  enviosApi,
  leerSnapshot,
  type DocTipo,
  type Envio,
} from './api';

/**
 * El tablero de Tesoreria.
 *
 * Mismo molde que el de quien firma, y a proposito: los dos son para alguien
 * que entra desde el telefono, hace UNA cosa y se va. Comparten las piezas
 * (`dashboard/tablero.tsx`), asi que no pueden separarse con el tiempo.
 *
 * No consulta las tablas de origen: lee `envios` y pinta su `snapshot`. No es
 * una limitacion, es el diseño --la regla que fijo la dueña es que cada
 * usuario es independiente y que lo unico que cruza es lo que alguien manda a
 * proposito. Darle lectura sobre `pagos` para que viera la SP que se le envio
 * seria darle TODOS los pagos, porque RLS concede por tabla y no por fila.
 *
 * Hoy le llegan solicitudes de vale y solicitudes de pago. Cuando se enchufe
 * caja chica le llegaran vales de dinero y liquidaciones, y los bloques
 * apareceran solos.
 */

function usePendientes() {
  return useQuery<Envio[], Error>({
    queryKey: [...ENVIOS_KEY, 'pendientes'],
    queryFn: () => enviosApi.pendientes(),
  });
}

function useResueltos() {
  return useQuery<Envio[], Error>({
    queryKey: [...ENVIOS_KEY, 'resueltos'],
    queryFn: () => enviosApi.resueltos(),
  });
}

/** El tono del distintivo según cuánto lleva esperando. */
function tonoEspera(diasEsperando: number | null): { etiqueta: string; tono: string } {
  if (diasEsperando != null && diasEsperando <= -5) {
    return { etiqueta: 'atrasado', tono: 'bg-rust text-white' };
  }
  if (diasEsperando != null && diasEsperando <= -2) {
    return { etiqueta: 'espera', tono: 'bg-gold text-white' };
  }
  return { etiqueta: 'nuevo', tono: 'bg-sand text-dark-2' };
}

export default function TesoreriaPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const pendientesQ = usePendientes();
  const resueltosQ = useResueltos();
  const [abierto, setAbierto] = useState<Envio | null>(null);

  const resolver = useMutation({
    mutationFn: async (v: {
      envio: Envio;
      datos: Record<string, unknown>;
      nota: string;
      aceptar: boolean;
    }) =>
      v.aceptar
        ? enviosApi.aceptar(v.envio.id, v.datos, v.nota || undefined)
        : enviosApi.rechazar(v.envio.id, v.nota),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ENVIOS_KEY });
      toast.success(v.aceptar ? 'Aceptado.' : 'Devuelto.');
      setAbierto(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * Aceptar y pagar son dos actos distintos, con semanas de por medio: el
   * combustible es a credito 30 dias. Por eso lo aceptado no desaparece.
   */
  const marcarPagado = useMutation({
    mutationFn: (pagoId: string) => enviosApi.marcarPagado(pagoId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ENVIOS_KEY });
      toast.success('Marcada como pagada.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendientes = pendientesQ.data ?? [];
  const porTipo = (t: DocTipo) => pendientes.filter((e) => e.doc_tipo === t);

  const vales = porTipo('comb_solicitud');
  const pagos = porTipo('pago');
  const ccVales = porTipo('cc_vale');
  const ccLiq = porTipo('cc_liquidacion');

  // El sello `pagado_at` lo pone la funcion al pagar, porque el Tesorero no
  // puede leer `pagos`: sin el, una SP aceptada y una pagada se le verian
  // iguales.
  const porPagar = (resueltosQ.data ?? []).filter(
    (e) =>
      e.doc_tipo === 'pago' &&
      e.estado === 'aceptado' &&
      !(e.datos && typeof e.datos === 'object' && 'pagado_at' in e.datos),
  );

  const totalPendiente = pendientes.length;
  const montoPorPagar = porPagar.reduce((a, e) => a + (leerSnapshot(e).monto ?? 0), 0);

  /** Un renglón a partir de un envío, igual en todos los bloques. */
  const renglon = (e: Envio, accion?: React.ReactNode) => {
    const s = leerSnapshot(e);
    const espera = enDias(e.enviado_at);
    const { etiqueta, tono } = tonoEspera(espera);
    return (
      <Renglon
        key={e.id}
        etiqueta={etiqueta}
        tono={tono}
        titulo={s.serial ?? DOC_TIPO_LABEL[e.doc_tipo as DocTipo]}
        detalle={s.detalle ?? ''}
        cifra={s.monto != null ? money(s.monto, s.moneda ?? 'GTQ') : null}
        pie={
          espera != null && espera <= -2
            ? `${Math.abs(espera)} días esperando`
            : dia(e.enviado_at)
        }
        alerta={espera != null && espera <= -5}
        accion={accion}
      />
    );
  };

  return (
    <section className="space-y-5">
      <Cabecera
        nombre={profile?.nombre}
        resumen={
          totalPendiente === 0
            ? porPagar.length > 0
              ? `Nada nuevo. Te quedan ${porPagar.length} ${porPagar.length === 1 ? 'pago' : 'pagos'} por ejecutar.`
              : 'No tienes nada pendiente. Aquí te aparecerá lo que te envíen.'
            : `Tienes ${totalPendiente} ${totalPendiente === 1 ? 'documento' : 'documentos'} esperándote.`
        }
      />

      {pendientesQ.error && (
        <p className="rounded-md border border-rust/40 bg-rust/10 px-3 py-2 text-sm text-rust">
          {pendientesQ.error.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloque
          titulo="Vales de combustible"
          bajada="Esperan que entregues el vale de la gasolinera"
          icono="⛽"
          cuenta={vales.length}
          color="#9e7a1a"
          cargando={pendientesQ.isLoading}
          vacio="Nadie te ha pedido un vale."
        >
          {vales.map((e) =>
            renglon(
              e,
              <BotonPrincipal onClick={() => setAbierto(e)}>Emitir vale</BotonPrincipal>,
            ),
          )}
        </Bloque>

        <Bloque
          titulo="Solicitudes de pago"
          bajada="Ya firmadas, esperando que las recibas"
          icono="🧾"
          cuenta={pagos.length}
          color="#077e84"
          cargando={pendientesQ.isLoading}
          vacio="No hay solicitudes de pago esperándote."
        >
          {pagos.map((e) =>
            renglon(e, <BotonPrincipal onClick={() => setAbierto(e)}>Recibir</BotonPrincipal>),
          )}
        </Bloque>
      </div>

      {/* Lo que ya recibiste y todavía no pagas. */}
      <Bloque
        titulo="Pendientes de pagar"
        bajada={
          montoPorPagar > 0
            ? `Ya las recibiste. Suman ${formatMoney(montoPorPagar)}`
            : 'Ya las recibiste, falta ejecutar el pago'
        }
        icono="💰"
        cuenta={porPagar.length}
        color="#bf4609"
        cargando={resueltosQ.isLoading}
        vacio="No tienes pagos pendientes de ejecutar."
      >
        {porPagar.map((e) =>
          renglon(
            e,
            <BotonPrincipal
              disabled={marcarPagado.isPending}
              onClick={() => marcarPagado.mutate(e.doc_id)}
            >
              Marcar pagada
            </BotonPrincipal>,
          ),
        )}
      </Bloque>

      {/* Caja chica todavía no está conectada: sus bloques aparecen solos
          cuando empiecen a llegar documentos, no antes vacíos. */}
      {ccVales.length > 0 && (
        <Bloque
          titulo="Vales de caja chica"
          bajada="Adelantos de efectivo"
          icono="💵"
          cuenta={ccVales.length}
          color="#6b4ea3"
          cargando={false}
          vacio=""
        >
          {ccVales.map((e) =>
            renglon(e, <BotonPrincipal onClick={() => setAbierto(e)}>Recibir</BotonPrincipal>),
          )}
        </Bloque>
      )}

      {ccLiq.length > 0 && (
        <Bloque
          titulo="Liquidaciones de caja chica"
          bajada="Rendiciones de gasto"
          icono="📒"
          cuenta={ccLiq.length}
          color="#6b4ea3"
          cargando={false}
          vacio=""
        >
          {ccLiq.map((e) =>
            renglon(e, <BotonPrincipal onClick={() => setAbierto(e)}>Recibir</BotonPrincipal>),
          )}
        </Bloque>
      )}

      {(resueltosQ.data ?? []).length > 0 && (
        <section className="rounded-card border border-sand bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-2 font-heading text-base font-extrabold text-dark">
            📋 Lo último que resolviste
          </h2>
          <ul className="divide-y divide-sand-l">
            {(resueltosQ.data ?? []).slice(0, 8).map((e) => {
              const s = leerSnapshot(e);
              const pagado =
                e.datos && typeof e.datos === 'object' && 'pagado_at' in e.datos;
              return (
                <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-dark-2">
                    {s.serial ?? s.titulo ?? DOC_TIPO_LABEL[e.doc_tipo as DocTipo]}
                  </span>
                  <span
                    className={`shrink-0 text-[11px] font-semibold ${
                      e.estado === 'rechazado' ? 'text-rust' : pagado ? 'text-teal' : 'text-dark-3'
                    }`}
                  >
                    {e.estado === 'rechazado' ? 'Devuelto' : pagado ? 'Pagado' : 'Recibido'}
                    {e.resuelto_at ? ` · ${formatDate(e.resuelto_at)}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Modal
        open={abierto != null}
        onClose={() => setAbierto(null)}
        title={abierto ? DOC_TIPO_LABEL[abierto.doc_tipo as DocTipo] : ''}
        size="md"
      >
        {abierto && (
          <Ficha
            envio={abierto}
            trabajando={resolver.isPending}
            onCancelar={() => setAbierto(null)}
            onResolver={(datos, nota, aceptar) =>
              resolver.mutate({ envio: abierto, datos, nota, aceptar })
            }
          />
        )}
      </Modal>
    </section>
  );
}

function Ficha({
  envio,
  trabajando,
  onResolver,
  onCancelar,
}: {
  envio: Envio;
  trabajando: boolean;
  onResolver: (datos: Record<string, unknown>, nota: string, aceptar: boolean) => void;
  onCancelar: () => void;
}) {
  const s = leerSnapshot(envio);
  const esVale = envio.doc_tipo === 'comb_solicitud';
  const [valeNum, setValeNum] = useState('');
  const [valeFecha, setValeFecha] = useState(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState('');

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-sand bg-sand-l/40 p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-heading font-extrabold text-dark">{s.serial ?? '—'}</span>
          {s.monto != null && (
            <span className="font-mono text-lg font-extrabold text-dark">
              {money(s.monto, s.moneda ?? 'GTQ')}
            </span>
          )}
        </div>
        {s.detalle && <p className="mb-2 text-sm text-dark-2">{s.detalle}</p>}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {s.fecha && (
            <>
              <dt className="text-dark-3">Fecha</dt>
              <dd className="text-dark">{formatDate(s.fecha)}</dd>
            </>
          )}
          {(s.campos ?? []).map((c) => (
            <div key={c.etiqueta} className="contents">
              <dt className="text-dark-3">{c.etiqueta}</dt>
              <dd className="text-dark">{c.valor}</dd>
            </div>
          ))}
        </dl>
      </div>

      {esVale && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="No. del vale que entregaste"
            hint="El número preimpreso de la gasolinera."
            value={valeNum}
            onChange={(e) => setValeNum(e.target.value)}
            required
          />
          <TextInput
            label="Fecha"
            type="date"
            value={valeFecha}
            onChange={(e) => setValeFecha(e.target.value)}
          />
        </div>
      )}

      <TextArea
        label="Nota"
        rows={2}
        placeholder="Opcional. Obligatoria si lo devuelves."
        value={nota}
        onChange={(e) => setNota(e.target.value)}
      />

      <div className="flex justify-between gap-2">
        <button
          type="button"
          disabled={trabajando || nota.trim() === ''}
          title={nota.trim() === '' ? 'Escribe por qué lo devuelves' : undefined}
          onClick={() => onResolver({}, nota, false)}
          className="rounded-md border border-rust/50 px-4 py-2 text-sm text-rust hover:bg-rust/10 disabled:opacity-40"
        >
          Devolver
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-md border border-sand px-4 py-2 text-sm text-dark-2 hover:bg-sand-l"
          >
            Cerrar
          </button>
          <button
            type="button"
            disabled={trabajando || (esVale && valeNum.trim() === '')}
            onClick={() =>
              onResolver(
                esVale ? { vale_num: valeNum.trim(), vale_fecha: valeFecha } : {},
                nota,
                true,
              )
            }
            className="rounded-md bg-teal px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-d disabled:opacity-60"
          >
            {trabajando ? 'Guardando…' : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}
