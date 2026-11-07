import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { DocumentAttachment } from '@/components/ui/DocumentAttachment';
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
import { leerDatosVale } from '@/modules/combustible/documento';
import { SolicitudValePrintable } from '@/modules/combustible/SolicitudValePrintable';
import { SolicitudPagoPrintable } from '@/modules/finanzas/pagos/SolicitudPagoPrintable';
import {
  DOC_TIPO_LABEL,
  leerDocumentoSP,
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
  /** El formato oficial, y la ficha de algo ya resuelto (sin botones). */
  const [papel, setPapel] = useState<Envio | null>(null);
  const [resumen, setResumen] = useState<Envio | null>(null);

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

  /**
   * El documento que viaja dentro del envío, ya con el número de vale que él
   * registró al aceptarlo. En el snapshot va vacío --cuando ella lo manda,
   * todavía no existe-- y es justamente el dato que él quiere volver a ver.
   */
  function documentoDe(e: Envio) {
    const d = leerDatosVale(leerSnapshot(e).documento);
    if (!d) return null;
    const dat = (e.datos ?? {}) as Record<string, unknown>;
    return {
      ...d,
      vale_num: (dat.vale_num as string | undefined) ?? d.vale_num ?? null,
    };
  }

  /**
   * Lo que lleva papel. El envio trae el documento congelado dentro; sin el
   * --los que se mandaron antes de que viajara-- solo queda la ficha, y el
   * boton no se ofrece en vez de abrir una hoja en blanco.
   */
  const tienePapel = (e: Envio) =>
    (e.doc_tipo === 'comb_solicitud' && documentoDe(e) != null) ||
    (e.doc_tipo === 'pago' && leerDocumentoSP(e) != null);

  const botonVer =
    'rounded-md border border-sand px-3 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l';

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
          {/*
            «Ver» antes que «Emitir vale», en ese orden: primero se mira el
            papel y despues se actua. Antes solo llegaba la ficha de cinco
            campos, asi que el emitia un vale sin haber visto la solicitud.
          */}
          {vales.map((e) =>
            renglon(
              e,
              <span className="flex gap-2">
                {tienePapel(e) && (
                  <button type="button" className={botonVer} onClick={() => setPapel(e)}>
                    Ver
                  </button>
                )}
                <BotonPrincipal onClick={() => setAbierto(e)}>Emitir vale</BotonPrincipal>
              </span>,
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
            renglon(
              e,
              <span className="flex gap-2">
                {tienePapel(e) && (
                  <button type="button" className={botonVer} onClick={() => setPapel(e)}>
                    Ver
                  </button>
                )}
                <BotonPrincipal onClick={() => setAbierto(e)}>Recibir</BotonPrincipal>
              </span>,
            ),
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
            <span className="flex gap-2">
              {tienePapel(e) && (
                <button type="button" className={botonVer} onClick={() => setPapel(e)}>
                  Ver
                </button>
              )}
              <button
                type="button"
                className={botonVer}
                onClick={() => setResumen(e)}
                title="El respaldo y lo que registraste"
              >
                Expediente
              </button>
              <BotonPrincipal
                disabled={marcarPagado.isPending}
                onClick={() => marcarPagado.mutate(e.doc_id)}
              >
                Marcar pagada
              </BotonPrincipal>
            </span>,
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
              const valeNum = (e.datos as Record<string, unknown> | null)?.vale_num as
                | string
                | undefined;
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-dark-2">
                    {s.serial ?? s.titulo ?? DOC_TIPO_LABEL[e.doc_tipo as DocTipo]}
                    {valeNum && (
                      <span className="ml-2 rounded bg-teal/15 px-1.5 py-0.5 text-[11px] font-semibold text-teal-d">
                        vale {valeNum}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-[11px] font-semibold ${
                      e.estado === 'rechazado' ? 'text-rust' : pagado ? 'text-teal' : 'text-dark-3'
                    }`}
                  >
                    {e.estado === 'rechazado' ? 'Devuelto' : pagado ? 'Pagado' : 'Recibido'}
                    {e.resuelto_at ? ` · ${formatDate(e.resuelto_at)}` : ''}
                  </span>
                  <span className="flex shrink-0 gap-2">
                    {tienePapel(e) && (
                      <button type="button" className={botonVer} onClick={() => setPapel(e)}>
                        Ver
                      </button>
                    )}
                    <button type="button" className={botonVer} onClick={() => setResumen(e)}>
                      Ver resumen
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* El formato oficial, el mismo que ella imprime. */}
      <PrintableModal
        open={papel != null}
        onClose={() => setPapel(null)}
        title={papel ? (leerSnapshot(papel).serial ?? 'Solicitud de vale') : ''}
      >
        {papel && papel.doc_tipo === 'comb_solicitud' && (
          <SolicitudValePrintable datos={documentoDe(papel) ?? {}} />
        )}
        {papel &&
          papel.doc_tipo === 'pago' &&
          (() => {
            const d = leerDocumentoSP(papel);
            if (!d) return null;
            return (
              <SolicitudPagoPrintable
                pago={d.pago}
                congelada={{
                  origenes: d.origenes,
                  firmoPor: d.firmoPor,
                  firmoFecha: d.firmoFecha,
                }}
              />
            );
          })()}
      </PrintableModal>

      {/* La ficha de algo ya resuelto: se mira, no se decide. */}
      <Modal
        open={resumen != null}
        onClose={() => setResumen(null)}
        title={resumen ? DOC_TIPO_LABEL[resumen.doc_tipo as DocTipo] : ''}
        size="md"
      >
        {resumen && <Ficha envio={resumen} trabajando={false} onCancelar={() => setResumen(null)} />}
      </Modal>

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

/**
 * La ficha de un envio.
 *
 * Sin `onResolver` es de solo lectura: lo ya resuelto se mira, no se decide
 * otra vez. Es el mismo componente a proposito --que la ficha de consulta
 * ensene lo mismo que la de decidir es justo lo que hay que poder confiar.
 */
function Ficha({
  envio,
  trabajando,
  onResolver,
  onCancelar,
}: {
  envio: Envio;
  trabajando: boolean;
  onResolver?: (datos: Record<string, unknown>, nota: string, aceptar: boolean) => void;
  onCancelar: () => void;
}) {
  const s = leerSnapshot(envio);
  const esVale = envio.doc_tipo === 'comb_solicitud';
  const soloLectura = onResolver == null;
  const datos = (envio.datos ?? {}) as Record<string, unknown>;
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

      {/*
        El expediente que respalda la solicitud de pago. El lo VE y no lo
        toca: lo arma quien hace la SP. Y ve solo el de las que le mandaron
        --la regla vive en la politica de `documentos`, que pregunta si puede
        ver esa SP; aqui no se decide nada.
      */}
      {envio.doc_tipo === 'pago' && (
        <>
          <DocumentAttachment
            entidadTipo="pago"
            entidadId={envio.doc_id}
            canEdit={false}
            label="Respaldo de la solicitud"
          />
          {/*
            Y lo que trae de donde nacio. El respaldo de una SP de combustible
            no esta en la SP: esta en el control de vales de la quincena. El
            camino se lo dice el envio --el no lee los avisos-- y el permiso
            lo da la politica de `documentos`, que sigue la cadena hasta aqui.
          */}
          {(s.origen ?? []).map((o) => (
            <DocumentAttachment
              key={`${o.tipo}-${o.id}`}
              entidadTipo={o.tipo}
              entidadId={o.id}
              canEdit={false}
              label={`Respaldo que trae ${o.que}`}
            />
          ))}
        </>
      )}

      {soloLectura && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-sand px-3 py-2 text-sm">
          <dt className="text-dark-3">Lo que registraste</dt>
          <dd className="text-dark">
            {envio.estado === 'rechazado' ? 'Devuelto' : 'Recibido'}
            {envio.resuelto_at ? ` · ${formatDate(envio.resuelto_at)}` : ''}
          </dd>
          {typeof datos.vale_num === 'string' && (
            <>
              <dt className="text-dark-3">No. del vale</dt>
              <dd className="font-mono font-semibold text-dark">{datos.vale_num}</dd>
            </>
          )}
          {typeof datos.vale_fecha === 'string' && (
            <>
              <dt className="text-dark-3">Fecha del vale</dt>
              <dd className="text-dark">{formatDate(datos.vale_fecha)}</dd>
            </>
          )}
          {typeof datos.pagado_at === 'string' && (
            <>
              <dt className="text-dark-3">Pagada</dt>
              <dd className="text-dark">{formatDate(datos.pagado_at)}</dd>
            </>
          )}
          {envio.nota && (
            <>
              <dt className="text-dark-3">Nota</dt>
              <dd className="text-dark">{envio.nota}</dd>
            </>
          )}
        </dl>
      )}

      {!soloLectura && esVale && (
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

      {!soloLectura && (
        <TextArea
          label="Nota"
          rows={2}
          placeholder="Opcional. Obligatoria si lo devuelves."
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      )}

      {soloLectura ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-md border border-sand px-4 py-2 text-sm text-dark-2 hover:bg-sand-l"
          >
            Cerrar
          </button>
        </div>
      ) : (
      <div className="flex justify-between gap-2">
        <button
          type="button"
          disabled={trabajando || nota.trim() === ''}
          title={nota.trim() === '' ? 'Escribe por qué lo devuelves' : undefined}
          onClick={() => onResolver?.({}, nota, false)}
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
              onResolver?.(
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
      )}
    </div>
  );
}
