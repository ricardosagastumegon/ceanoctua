import type { EstadoPago } from '../constants/serviceMeta';
import { ESTADO_PAGO_COLORS } from '../constants/serviceMeta';

// Badge de color para el estado_pago de un servicio.
// Paridad con ttEstadoBadgeColors del HTML.
export function EstadoPagoBadge({ estado }: { estado: EstadoPago | null | undefined }) {
  if (!estado) return null;
  const c = ESTADO_PAGO_COLORS[estado];
  return (
    <span
      style={{ backgroundColor: c.bg, color: c.fg }}
      className="ml-1 inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
    >
      {estado}
    </span>
  );
}
