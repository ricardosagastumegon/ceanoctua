import { useQuery } from '@tanstack/react-query';
import { DocumentAttachment } from '@/components/ui/DocumentAttachment';
import { supabase } from '@/lib/supabase';
import type { Pago } from './api';

/**
 * El expediente de una solicitud de pago: lo suyo, y lo que trae de donde
 * nacio.
 *
 * LA SP ES EL FINAL DE CADENAS DISTINTAS. Lo dijo la usuaria: «las SP pueden
 * nacer desde un vale, pasar por una liquidacion, o pueden nacer desde un
 * vale de combustible, pasar por toda la cadena y llegar a la SP». El
 * respaldo no se sube aqui: se sube donde se arma --el control de vales de la
 * quincena, la liquidacion de caja chica-- y aqui se ENSEÑA, sin copiarlo.
 *
 * Por eso son dos paneles y no uno. El de arriba es editable y guarda lo que
 * se adjunta directamente a esta solicitud; el de abajo es de solo lectura y
 * enseña lo que venia con el origen. Mezclarlos en una sola lista haria creer
 * que borrar desde aqui quita el respaldo de la quincena, y no es asi: ese
 * archivo es del control de vales y de ahi se quita.
 *
 * Quien lo ve lo decide la politica de `documentos`, que sigue la cadena
 * hasta la SP. Esta pantalla no comprueba permisos: pide, y le llega lo que
 * le corresponde.
 */

/** De donde viene el aviso que genero esta SP, a donde cuelgan sus adjuntos. */
export const ENTIDAD_DEL_ORIGEN: Record<string, {
  tipo: string;
  que: string;
  /**
   * Casi todos los orígenes cuelgan sus adjuntos DE SÍ MISMOS: el control de
   * vales tiene los suyos, el consumo los suyos. La liquidación del piloto
   * no: cada foto cuelga de SU GASTO, porque es la factura de ese renglón
   * —que es justo lo que hace bueno al formato—. Para esos, `expandir` dice
   * de qué entidades hay que recoger.
   */
  expandir?: (origenId: string) => Promise<{ id: string; etiqueta: string }[]>;
}> = {
  combustible_vehiculos: { tipo: 'comb_reporte', que: 'el control de vales' },
  liquidacion: { tipo: 'caja_chica_liquidacion', que: 'la liquidación' },
  consumo_tc: { tipo: 'consumo', que: 'el consumo' },
  combustible: { tipo: 'avn_combustible', que: 'el registro de combustible' },
  avn_liquidacion: {
    tipo: 'avn_liq_gasto',
    que: 'la liquidación del piloto',
    expandir: async (id) => {
      const { data, error } = await supabase
        .from('avn_liquidacion_gastos')
        .select('id, proveedor, documento')
        .eq('liquidacion_id', id)
        .order('orden');
      if (error) throw error;
      return (data ?? []).map((g) => ({
        id: g.id,
        etiqueta: [g.proveedor, g.documento].filter(Boolean).join(' · '),
      }));
    },
  },
};

/**
 * Las entidades de las que hay que recoger adjuntos para un origen. Un solo
 * sitio: antes este mapa estaba copiado también en `SPConAdjuntos`, y añadir
 * un origen exigía acordarse de los dos. El que se olvidara daba una SP que
 * se imprime sin la mitad de su respaldo, sin ningún error.
 */
export async function entidadesDelOrigen(
  origenTipo: string,
  origenId: string,
): Promise<{ tipo: string; id: string; etiqueta?: string }[]> {
  const e = ENTIDAD_DEL_ORIGEN[origenTipo];
  if (!e) return [];
  if (!e.expandir) return [{ tipo: e.tipo, id: origenId }];
  const hijos = await e.expandir(origenId);
  return hijos.map((h) => ({ tipo: e.tipo, id: h.id, etiqueta: h.etiqueta }));
}

export type Origen = {
  id: string;
  resumen: string | null;
  origen_tipo: string;
  origen_id: string | null;
  /** Hacen falta para congelar el papel que vera el Tesorero. */
  monto: number | null;
  moneda: string | null;
};

/**
 * Los avisos que dieron lugar a esta SP. Se leen por `pago_id`; las creadas
 * antes de que eso se guardara tienen su unico origen en
 * `origen_notificacion_id`. Es el mismo criterio del imprimible oficial, a
 * proposito: las dos pantallas tienen que estar hablando de lo mismo.
 */
export function useOrigenes(pago: Pago) {
  return useQuery<Origen[], Error>({
    queryKey: ['pago_origenes_adjuntos', pago.id, pago.origen_notificacion_id],
    queryFn: async () => {
      const porPago = await supabase
        .from('pagos_notificaciones')
        .select('id, resumen, origen_tipo, origen_id, monto, moneda')
        .eq('pago_id', pago.id)
        .order('created_at');
      if (porPago.error) throw porPago.error;
      if ((porPago.data ?? []).length > 0) return porPago.data as Origen[];
      if (!pago.origen_notificacion_id) return [];
      const suelta = await supabase
        .from('pagos_notificaciones')
        .select('id, resumen, origen_tipo, origen_id, monto, moneda')
        .eq('id', pago.origen_notificacion_id);
      if (suelta.error) throw suelta.error;
      return (suelta.data ?? []) as Origen[];
    },
  });
}

export function ExpedienteDeLaSP({ pago, canEdit }: { pago: Pago; canEdit: boolean }) {
  const origenesQ = useOrigenes(pago);
  const origenes = (origenesQ.data ?? []).filter(
    (o) => o.origen_id && ENTIDAD_DEL_ORIGEN[o.origen_tipo],
  );

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-sand bg-sand-l/40 px-3 py-2 text-xs text-dark-2">
        Lo que respalda esta solicitud. <strong>Lo ve quien ve la solicitud</strong> — quien
        la firma y quien la recibe.
      </p>

      <DocumentAttachment
        entidadTipo="pago"
        entidadId={pago.id}
        canEdit={canEdit}
        label="Adjuntos de esta solicitud"
        accept="application/pdf,image/*"
      />

      {origenes.map((o) => (
        <RespaldoDelOrigen key={o.id} origen={o} />
      ))}
    </div>
  );
}

/**
 * El respaldo que trae un origen. Casi siempre es un bloque; para la
 * liquidacion del piloto son varios --uno por gasto-- porque cada factura
 * pertenece a su renglon y no al viaje entero.
 */
function RespaldoDelOrigen({ origen: o }: { origen: Origen }) {
  const e = ENTIDAD_DEL_ORIGEN[o.origen_tipo];
  const partes = useQuery({
    queryKey: ['expediente_origen_partes', o.origen_tipo, o.origen_id],
    queryFn: () => entidadesDelOrigen(o.origen_tipo, o.origen_id as string),
    enabled: !!o.origen_id && !!e,
  });

  if (!e) return null;

  return (
    <div className="border-t border-sand pt-3">
      <p className="mb-2 text-xs text-dark-3">
        Viene de {e.que}
        {o.resumen ? ` · ${o.resumen}` : ''}. Se quita desde ahí, no desde aquí.
      </p>
      {(partes.data ?? []).map((p) => (
        <DocumentAttachment
          key={p.id}
          entidadTipo={p.tipo}
          entidadId={p.id}
          canEdit={false}
          label={p.etiqueta ? `Factura · ${p.etiqueta}` : `Respaldo que trae ${e.que}`}
        />
      ))}
    </div>
  );
}

/**
 * Quien firmo una solicitud de pago. Mismo criterio que el imprimible
 * oficial: la firma en estado `firmado`, la mas reciente.
 *
 * Vive aqui y no dentro del imprimible porque hace falta ANTES, al congelar
 * el envio al Tesorero --el no lee `firmas`, asi que el dato tiene que salir
 * de aqui o no sale.
 */
export function useFirmaDePago(pagoId: string | null) {
  return useQuery<{ por: string | null; fecha: string | null } | null, Error>({
    queryKey: ['firma_del_pago', pagoId],
    enabled: !!pagoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('firmas')
        .select('firmada_por, fecha_firma')
        .eq('pago_id', pagoId as string)
        .eq('status_firma', 'firmado')
        .is('deleted_at', null)
        .order('fecha_firma', { ascending: false })
        .limit(1);
      if (error) throw error;
      const f = (data ?? [])[0];
      return f ? { por: f.firmada_por, fecha: f.fecha_firma } : null;
    },
  });
}
