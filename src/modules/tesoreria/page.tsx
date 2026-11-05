import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  DOC_TIPO_LABEL,
  ENVIOS_KEY,
  enviosApi,
  leerSnapshot,
  type DocTipo,
  type Envio,
} from './api';

/**
 * La bandeja de Tesoreria.
 *
 * No consulta las tablas de origen: lee `envios` y pinta su `snapshot`. Eso no
 * es una limitacion, es el diseño --la usuaria fijo que cada usuario es
 * independiente y que lo unico que cruza es lo que alguien manda a proposito.
 * Darle lectura sobre `pagos` para que viera la SP que se le envio seria darle
 * todos los pagos, porque RLS concede por tabla y no por fila.
 *
 * Hoy le llegan solicitudes de vale y solicitudes de pago. Cuando se enchufe
 * caja chica le llegaran vales de dinero y liquidaciones, y esta pantalla no
 * cambia: aparecen solas.
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

const COLOR: Record<string, string> = {
  comb_solicitud: 'bg-gold/20 text-dark',
  comb_reporte: 'bg-purple/15 text-purple',
  pago: 'bg-teal/15 text-teal',
  cc_vale: 'bg-sand text-dark-2',
  cc_liquidacion: 'bg-sand text-dark-2',
};

export default function TesoreriaPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const pendientesQ = usePendientes();
  const resueltosQ = useResueltos();
  const [abierto, setAbierto] = useState<Envio | null>(null);

  /**
   * Aceptar una SP y pagarla son dos actos distintos, con semanas de por
   * medio: el combustible es a credito 30 dias. Por eso las aceptadas no
   * desaparecen -- se quedan en su propia pila hasta que se pagan.
   */
  const marcarPagado = useMutation({
    mutationFn: (pagoId: string) => enviosApi.marcarPagado(pagoId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ENVIOS_KEY });
      toast.success('Marcada como pagada.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolver = useMutation({
    mutationFn: async (v: { envio: Envio; datos: Record<string, unknown>; nota: string; aceptar: boolean }) =>
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

  const pendientes = pendientesQ.data ?? [];

  const porTipo = (t: DocTipo) => pendientes.filter((e) => e.doc_tipo === t);

  // El sello `pagado_at` lo pone la funcion al pagar, porque el Tesorero no
  // puede leer `pagos`: sin el, una SP aceptada y una pagada se le verian
  // iguales.
  const porPagar = (resueltosQ.data ?? []).filter(
    (e) =>
      e.doc_tipo === 'pago' &&
      e.estado === 'aceptado' &&
      !(e.datos && typeof e.datos === 'object' && 'pagado_at' in e.datos),
  );

  const pilas: { tipo: DocTipo; titulo: string; vacio: string }[] = [
    {
      tipo: 'comb_solicitud',
      titulo: 'Vales de combustible por emitir',
      vacio: 'Ninguna solicitud esperando vale.',
    },
    {
      tipo: 'pago',
      titulo: 'Solicitudes de pago firmadas',
      vacio: 'Ninguna solicitud de pago pendiente.',
    },
    { tipo: 'cc_vale', titulo: 'Vales de caja chica', vacio: 'Nada pendiente.' },
    { tipo: 'cc_liquidacion', titulo: 'Liquidaciones de caja chica', vacio: 'Nada pendiente.' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-dark">Tesorería</h1>
        <p className="text-sm text-dark-3">
          Lo que te han enviado. Al aceptar, el documento avanza solo del otro lado.
        </p>
      </header>

      {pendientesQ.isLoading && <p className="text-sm text-dark-3">Cargando…</p>}
      {pendientesQ.error && (
        <p className="rounded-md border border-rust/40 bg-rust/10 px-3 py-2 text-sm text-rust">
          {pendientesQ.error.message}
        </p>
      )}

      {pilas
        // Las pilas que todavia no existen --caja chica-- no se muestran
        // vacias: apareceran solas cuando empiecen a llegar.
        .filter((p) => porTipo(p.tipo).length > 0 || p.tipo === 'comb_solicitud' || p.tipo === 'pago')
        .map((p) => {
          const items = porTipo(p.tipo);
          return (
            <section key={p.tipo}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-dark">
                {p.titulo}
                {items.length > 0 && (
                  <span className="rounded-full bg-teal px-2 py-0.5 text-xs text-white">
                    {items.length}
                  </span>
                )}
              </h2>
              {items.length === 0 ? (
                <p className="text-sm text-dark-3">{p.vacio}</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setAbierto(e)}
                        className="w-full rounded-md border border-sand bg-white px-3 py-2 text-left hover:border-teal"
                      >
                        <Resumen envio={e} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

      {porPagar.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-dark">
            Aceptadas, pendientes de pagar
            <span className="rounded-full bg-gold px-2 py-0.5 text-xs text-white">
              {porPagar.length}
            </span>
          </h2>
          <ul className="space-y-2">
            {porPagar.map((e) => {
              const s = leerSnapshot(e);
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-sand bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-dark">{s.serial ?? '—'}</span>
                    {s.detalle && (
                      <p className="truncate text-sm text-dark-2">{s.detalle}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {s.monto != null && (
                      <span className="font-medium text-dark">{formatMoney(s.monto)}</span>
                    )}
                    <button
                      type="button"
                      disabled={marcarPagado.isPending}
                      onClick={() => marcarPagado.mutate(e.doc_id)}
                      className="rounded-md bg-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-teal/90 disabled:opacity-60"
                    >
                      Marcar pagada
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(resueltosQ.data ?? []).length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dark-2">Resueltos recientemente</h2>
          <ul className="space-y-1">
            {(resueltosQ.data ?? []).slice(0, 10).map((e) => {
              const s = leerSnapshot(e);
              return (
                <li key={e.id} className="flex justify-between border-b border-sand-l py-1 text-sm">
                  <span className="text-dark-2">
                    {s.titulo ?? DOC_TIPO_LABEL[e.doc_tipo as DocTipo]}
                  </span>
                  <span className={e.estado === 'aceptado' ? 'text-teal' : 'text-rust'}>
                    {e.estado === 'aceptado' ? 'Aceptado' : 'Devuelto'}
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
    </div>
  );
}

function Resumen({ envio }: { envio: Envio }) {
  const s = leerSnapshot(envio);
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
              COLOR[envio.doc_tipo] ?? 'bg-sand-l text-dark-2'
            }`}
          >
            {s.serial ?? DOC_TIPO_LABEL[envio.doc_tipo as DocTipo]}
          </span>
          {s.fecha && <span className="text-xs text-dark-3">{formatDate(s.fecha)}</span>}
        </div>
        {s.detalle && <p className="mt-1 truncate text-sm text-dark-2">{s.detalle}</p>}
      </div>
      {s.monto != null && (
        <span className="whitespace-nowrap text-sm font-medium text-dark">
          {formatMoney(s.monto)}
        </span>
      )}
    </div>
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
          <span className="font-semibold text-dark">{s.serial ?? '—'}</span>
          {s.monto != null && (
            <span className="text-lg font-semibold text-dark">{formatMoney(s.monto)}</span>
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
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90 disabled:opacity-60"
          >
            {trabajando ? 'Guardando…' : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}
