import { TextInput } from '@/components/ui/TextInput';

export type OwRt = 'OW' | 'RT';

export type OwRtValues = {
  tipo: OwRt;
  fecha: string; origen: string; destino: string;
  etd: string; eta: string;
  retFecha: string; retOrigen: string; retDestino: string;
  retEtd: string; retEta: string;
};

type Props = OwRtValues & {
  onChange: (patch: Partial<OwRtValues>) => void;
  /**
   * Colores del servicio. Cada uno tiene el suyo, así que el selector OW/RT
   * se pinta con el del servicio que lo monta en vez del teal por defecto.
   */
  color?: { solid: string; dark: string; light: string };
};

// Bloque de ruta con selector OW/RT · reutilizado por Acuaticos, Ferries y
// Terrestres. Cuando tipo=RT muestra los campos de retorno.
export function OwRtFields({ tipo, fecha, origen, destino, etd, eta, retFecha, retOrigen, retDestino, retEtd, retEta, onChange, color }: Props) {
  const activo = color
    ? { borderColor: color.solid, backgroundColor: color.light, color: color.dark }
    : undefined;
  const claseActiva = color
    ? 'flex-1 rounded-md border-2 px-3 py-2 text-sm font-extrabold'
    : 'flex-1 rounded-md border-2 border-teal bg-teal-l px-3 py-2 text-sm font-extrabold text-teal-d';
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">Servicio contratado</label>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ tipo: 'OW' })}
            style={tipo === 'OW' ? activo : undefined}
            className={
              tipo === 'OW'
                ? claseActiva
                : 'flex-1 rounded-md border border-sand bg-white px-3 py-2 text-sm font-semibold text-dark-3 hover:border-teal/50'
            }
          >
            OW<div className="text-[10px] font-semibold normal-case">Solo ida</div>
          </button>
          <button
            type="button"
            onClick={() => onChange({ tipo: 'RT' })}
            style={tipo === 'RT' ? activo : undefined}
            className={
              tipo === 'RT'
                ? claseActiva
                : 'flex-1 rounded-md border border-sand bg-white px-3 py-2 text-sm font-semibold text-dark-3 hover:border-teal/50'
            }
          >
            RT<div className="text-[10px] font-semibold normal-case">Ida y vuelta</div>
          </button>
        </div>
      </div>

      <div className="text-xs font-extrabold uppercase tracking-wider text-dark-2">
        {tipo === 'RT' ? 'Ruta de salida' : 'Ruta'}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => onChange({ fecha: e.target.value })} />
        <TextInput label="Origen" value={origen} onChange={(e) => onChange({ origen: e.target.value })} />
        <TextInput label="Destino" value={destino} onChange={(e) => onChange({ destino: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextInput label="ETD (hh:mm)" type="time" value={etd} onChange={(e) => onChange({ etd: e.target.value })} />
        <TextInput label="ETA (hh:mm)" type="time" value={eta} onChange={(e) => onChange({ eta: e.target.value })} />
      </div>

      {tipo === 'RT' && (
        <>
          <div className="text-xs font-extrabold uppercase tracking-wider text-dark-2">↩ Ruta de regreso</div>
          <div className="grid grid-cols-3 gap-2">
            <TextInput label="Fecha" type="date" value={retFecha} onChange={(e) => onChange({ retFecha: e.target.value })} />
            <TextInput label="Origen" value={retOrigen} onChange={(e) => onChange({ retOrigen: e.target.value })} />
            <TextInput label="Destino" value={retDestino} onChange={(e) => onChange({ retDestino: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextInput label="ETD retorno" type="time" value={retEtd} onChange={(e) => onChange({ retEtd: e.target.value })} />
            <TextInput label="ETA retorno" type="time" value={retEta} onChange={(e) => onChange({ retEta: e.target.value })} />
          </div>
        </>
      )}
    </div>
  );
}

export const emptyOwRt: OwRtValues = {
  tipo: 'OW',
  fecha: '', origen: '', destino: '', etd: '', eta: '',
  retFecha: '', retOrigen: '', retDestino: '', retEtd: '', retEta: '',
};
