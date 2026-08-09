import { TextInput } from '@/components/ui/TextInput';
import { PaymentMethodSelect } from './PaymentMethodSelect';
import type { EstadoPago } from '../constants/serviceMeta';

const ESTADOS: readonly EstadoPago[] = [
  'Reservado',
  'Pagado',
  'Pago parcial',
  'A pagar en propiedad',
  'Cancelado',
];

type Props = {
  estatusPago: string;
  onEstatusPago: (v: string) => void;
  estadoPago: EstadoPago;
  onEstadoPago: (v: EstadoPago) => void;
  pagadoCon: string;
  onPagadoCon: (v: string) => void;
  confirmFileName: string;
  onConfirmFileName: (v: string) => void;
};

// Bloque común "Payment" reutilizado en 10 servicios con costo (paridad HTML).
// Renderiza: estatus_pago (texto) + estado_pago (select) + pagado_con (select tc) +
// confirm_file_name (texto — el file real será F19-3 futuro con Storage).
export function PaymentFields({
  estatusPago,
  onEstatusPago,
  estadoPago,
  onEstadoPago,
  pagadoCon,
  onPagadoCon,
  confirmFileName,
  onConfirmFileName,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="Estatus de pago"
          value={estatusPago}
          onChange={(e) => onEstatusPago(e.target.value)}
          placeholder="Ej: Depósito 50% pagado"
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
            Estado
          </label>
          <select
            value={estadoPago}
            onChange={(e) => onEstadoPago(e.target.value as EstadoPago)}
            className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          >
            {ESTADOS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <PaymentMethodSelect
        label="Pagado con"
        value={pagadoCon}
        onChange={onPagadoCon}
      />
      <TextInput
        label="Comprobante · nombre del archivo"
        value={confirmFileName}
        onChange={(e) => onConfirmFileName(e.target.value)}
        placeholder="Ej: confirmacion-hilton.pdf"
        hint="Solo se guarda el nombre. Storage de archivos vendrá en fase futura."
      />
    </>
  );
}
