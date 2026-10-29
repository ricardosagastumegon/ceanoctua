import { duenioTarjeta, useTarjetasPago } from './tarjetas';

type Props = {
  /** `pagado_con_id` del servicio. */
  id: string | null | undefined;
  /** `pagado_con`: el texto del día que se capturó, por si no hay id. */
  texto?: string | null;
};

/**
 * Con qué se pagó el servicio, en la fila de la lista.
 *
 * Antes había que abrir el servicio para saberlo, y al cuadrar un viaje se
 * abría uno por uno. Va entre el detalle y el monto, que es el hueco que
 * dejaba el renglón.
 *
 * Si no se pudo identificar la tarjeta se muestra el texto guardado tal cual
 * --«Efectivo», «Transferencia Bancaria» o lo que se haya escrito--: decir
 * «sin tarjeta» cuando sí hubo forma de pago seria mentir.
 */
export function TarjetaServicio({ id, texto }: Props) {
  const { data } = useTarjetasPago();
  const tarjeta = id ? (data ?? []).find((t) => t.id === id) ?? null : null;

  if (!tarjeta) {
    return (
      <div className="hidden w-48 shrink-0 text-right sm:block">
        <div className="truncate text-[11px] text-dark-3">{texto || '—'}</div>
      </div>
    );
  }

  return (
    <div className="hidden w-48 shrink-0 text-right sm:block" title={texto ?? tarjeta.tc_id ?? ''}>
      <div className="flex items-center justify-end gap-1.5">
        <span
          className="h-3 w-4 shrink-0 rounded-[2px] border border-black/10"
          style={{
            background: `linear-gradient(135deg, ${tarjeta.color ?? '#0d2b2e'}cc, ${
              tarjeta.color ?? '#0d2b2e'
            })`,
          }}
        />
        <span className="truncate text-[11px] font-extrabold text-dark-2">{tarjeta.tc_id}</span>
      </div>
      <div className="truncate text-[10px] text-dark-3">
        {duenioTarjeta(tarjeta)}
        {!tarjeta.activo && <span className="ml-1 font-extrabold text-rust">· de baja</span>}
      </div>
    </div>
  );
}
