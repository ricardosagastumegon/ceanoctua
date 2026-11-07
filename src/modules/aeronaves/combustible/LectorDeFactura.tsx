import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { describeError } from '@/modules/admin/hooks';
import { useActualizarRegistro } from './hooks';
import { compararConElRegistro, leerFactura, type Desacuerdo, type FacturaLeida } from './leerFactura';
import type { RegistroCompleto } from './api';

/**
 * Leer la factura adjunta y volcarla al registro.
 *
 * EL ORDEN DE LAS COSAS en la vida real: el vale llega el mismo dia, con lo
 * poco que trae escrito a mano; la factura llega uno o dos dias despues y
 * trae todo --serie, numero, FER, fecha, galones, precio y total. Asi que el
 * registro nace a medias a proposito, y esta pantalla es la que lo termina.
 *
 * NO SOBRESCRIBE EN SILENCIO. Lo que ya estaba escrito y la factura
 * contradice se ensena lado a lado antes de guardar. Son dos fuentes del
 * mismo dato --una tecleada, otra leida-- y que puedan desmentirse es lo
 * unico que convierte un teclazo en algo que se ve. Un «3470» por «3740»
 * corregido sin avisar es un error que nadie supo que hubo.
 */

type Adjunto = { id: string; nombre: string; storage_path: string; tipo_mime: string | null };

export function LectorDeFactura({
  registro,
  aeronaveId,
  canEdit,
}: {
  registro: RegistroCompleto;
  aeronaveId: string;
  canEdit: boolean;
}) {
  const toast = useToast();
  const actualizar = useActualizarRegistro(aeronaveId);

  const [pdfs, setPdfs] = useState<Adjunto[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [leida, setLeida] = useState<FacturaLeida | null>(null);
  const [choques, setChoques] = useState<Desacuerdo[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Los PDF adjuntos al registro. Se vuelve a consultar cada vez que se abre
  // porque el panel de adjuntos de al lado puede haber subido uno recien.
  useEffect(() => {
    let vivo = true;
    void supabase
      .from('documentos')
      .select('id, nombre, storage_path, tipo_mime')
      .eq('entidad_tipo', 'avn_combustible')
      .eq('entidad_id', registro.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!vivo) return;
        setPdfs(
          (data ?? []).filter(
            (d) => d.tipo_mime === 'application/pdf' || /\.pdf$/i.test(d.nombre),
          ) as Adjunto[],
        );
      });
    return () => {
      vivo = false;
    };
  }, [registro.id, leida]);

  async function leer(a: Adjunto) {
    setLeyendo(true);
    setLeida(null);
    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(a.storage_path, 120);
      if (error || !data?.signedUrl) throw error ?? new Error('No se pudo abrir el archivo.');
      const bytes = await (await fetch(data.signedUrl)).arrayBuffer();
      const f = await leerFactura(bytes);

      if (!f.numero && !f.fer && f.total == null) {
        toast.error('Ese PDF no parece una factura FEL: no se encontró ni número ni FER.');
        return;
      }
      setLeida(f);
      setChoques(compararConElRegistro(f, registro));
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setLeyendo(false);
    }
  }

  async function guardar() {
    if (!leida) return;
    setGuardando(true);
    try {
      // Las lineas se reemplazan enteras --asi funciona la API-- con lo que
      // dice la factura. Si no trajera galones o precio se deja lo que habia:
      // es preferible un registro con lo tecleado que uno con ceros.
      const lineaVieja = registro.lineas[0];
      const lineas =
        leida.galones != null && leida.precioUnitario != null
          ? [
              {
                producto: leida.producto ?? lineaVieja?.producto ?? 'Gasolina',
                galones: leida.galones,
                precio_unitario: leida.precioUnitario,
              },
            ]
          : registro.lineas.map((l) => ({
              producto: l.producto,
              galones: Number(l.galones),
              precio_unitario: Number(l.precio_unitario),
            }));

      await actualizar.mutateAsync({
        id: registro.id,
        patch: {
          factura: leida.numero ?? registro.factura,
          fer_ap: leida.fer ?? registro.fer_ap,
          fecha: leida.fecha ?? registro.fecha,
          vale: registro.vale ?? leida.vale,
        },
        lineas,
      });
      toast.success('Registro completado con la factura.');
      setLeida(null);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setGuardando(false);
    }
  }

  if (pdfs.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-sand px-3 py-3 text-center text-xs text-dark-3">
        Adjunta la factura en PDF y desde aquí se lee sola.
      </p>
    );
  }

  const fila = (etiqueta: string, valor: string | number | null | undefined) => (
    <div className="contents">
      <dt className="text-dark-3">{etiqueta}</dt>
      <dd className="font-medium text-dark">{valor === null || valor === undefined || valor === '' ? '—' : valor}</dd>
    </div>
  );

  return (
    <div className="space-y-3">
      {!leida && (
        <div className="space-y-2">
          {pdfs.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={leyendo}
              onClick={() => void leer(a)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-teal/40 bg-teal-l/40 px-3 py-2 text-left text-sm font-semibold text-teal-d hover:bg-teal-l disabled:opacity-60"
            >
              <span className="min-w-0 truncate">📄 {a.nombre}</span>
              <span className="shrink-0">{leyendo ? 'Leyendo…' : 'Leer la factura'}</span>
            </button>
          ))}
        </div>
      )}

      {leida && (
        <div className="space-y-3">
          <div className="rounded-md border border-sand bg-sand-l/40 p-3">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-teal-d">
              Lo que dice la factura
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {fila('Serie', leida.serie)}
              {fila('Número', leida.numero)}
              {fila('FER/AP', leida.fer)}
              {fila('Fecha', leida.fecha)}
              {fila('Producto', leida.producto)}
              {fila('Galones', leida.galones)}
              {fila('Precio por galón', leida.precioUnitario)}
              {fila('Total', leida.total != null ? `Q ${leida.total.toFixed(2)}` : null)}
              {fila('Vale que cita', leida.vale)}
            </dl>
          </div>

          {choques.length > 0 && (
            <div className="rounded-md border border-rust/40 bg-rust-l/40 p-3">
              <p className="mb-2 text-xs font-extrabold text-rust">
                Ojo: no cuadra con lo que ya tiene el registro
              </p>
              <ul className="space-y-1 text-sm">
                {choques.map((c) => (
                  <li key={c.campo}>
                    <strong>{c.campo}:</strong> el registro dice{' '}
                    <span className="font-mono">{c.registro}</span>, la factura dice{' '}
                    <span className="font-mono font-bold">{c.factura}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-dark-2">
                Si guardas, manda lo que dice la factura.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLeida(null)}
              className="rounded-md border border-sand px-4 py-2 text-sm text-dark-2 hover:bg-sand-l"
            >
              Descartar
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={guardando}
                onClick={() => void guardar()}
                className="rounded-md bg-teal px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-d disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar en el registro'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
