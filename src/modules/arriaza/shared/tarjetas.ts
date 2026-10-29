import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Las tarjetas del catálogo, para pintar con qué se pagó.
 *
 * Una sola consulta para toda la pantalla del viaje: el desplegable de pago
 * y las once secciones de servicios leen de aquí, así que abrir un viaje con
 * catorce servicios no dispara catorce consultas.
 *
 * Trae también las dadas de baja. No se pueden elegir para cobrar nada nuevo
 * --de eso se encarga quien ofrece la lista--, pero un servicio guardado con
 * una de ellas tiene que seguir diciendo con qué se pagó.
 */

export type TarjetaPago = {
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

export function useTarjetasPago() {
  return useQuery({
    queryKey: ['tarjetas_credito', 'pagado_con'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TarjetaPago[]> => {
      const { data, error } = await supabase
        .from('tarjetas_credito')
        .select('id, tc_id, tipo, empresa, red, banco, titular, color, activo');
      if (error) throw error;
      return ((data ?? []) as TarjetaPago[]).sort((a, b) =>
        (a.tc_id ?? '').localeCompare(b.tc_id ?? ''),
      );
    },
  });
}

/**
 * El texto que se muestra y se guarda en `pagado_con`.
 *
 * El `tc_id` va SIEMPRE de primero: la liquidación saca de ahí el nombre
 * corto de una hoja impresa hace meses (`texto.split(' · ')[0]`). Cambiar ese
 * orden reescribiría en silencio lo que dicen los reportes viejos.
 */
export function etiquetaTarjeta(t: TarjetaPago): string {
  return [t.tc_id, t.empresa, t.red, t.banco, t.titular].filter(Boolean).join(' · ');
}

/** De quién es la tarjeta: la empresa si es corporativa, el titular si no. */
export function duenioTarjeta(t: TarjetaPago): string {
  return t.empresa ?? t.titular ?? t.banco ?? '';
}

/** A quién pertenece y en qué banco, para la línea de abajo. */
export function subtituloTarjeta(t: TarjetaPago): string {
  return t.empresa ?? [t.banco, t.titular].filter(Boolean).join(' · ');
}

/** La terminación, que es lo único que de verdad distingue una tarjeta de otra. */
export function terminacionTarjeta(tcId: string | null): string | null {
  const m = (tcId ?? '').match(/(\d{3,6})\s*$/);
  return m ? m[1] : null;
}
