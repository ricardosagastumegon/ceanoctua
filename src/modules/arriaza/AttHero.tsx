import logoBlanco from './arriaza-logo-blanco.png';

type Props = {
  viajes: number;
  curso: number;
  proximos: number;
  canEdit: boolean;
  onCreate: () => void;
};

/**
 * Encabezado del módulo · calcado del HTML standalone.
 *
 * El bloque oscuro de la izquierda enmarca el logo y se desvanece hacia el
 * degradado. Va como capa aparte en vez de un segundo fondo para que el
 * degradado principal siga corriendo de lado a lado por debajo.
 *
 * Vive fuera de AttPage para poder verlo en aislamiento contra la imagen de
 * referencia, sin montar auth ni router.
 */
export function AttHero({ viajes, curso, proximos, canEdit, onCreate }: Props) {
  return (
    <div className="relative overflow-hidden rounded-card border-b-4 border-gold bg-gradient-to-r from-navy via-teal-d to-aqua text-white shadow-lg">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[420px]"
        style={{ background: 'linear-gradient(90deg, #0d2b2e 55%, rgba(13,43,46,0) 100%)' }}
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-4">
          <img src={logoBlanco} alt="Arriaza Tour &amp; Travel" className="h-10 w-auto shrink-0" />
          <div className="border-l border-white/20 pl-4">
            <div className="text-[10px] font-extrabold uppercase tracking-[.22em] text-white/55">
              Tour &amp; Travel
            </div>
            <div className="mt-0.5 text-[13px] font-extrabold text-white/90">
              Investigación · Planeación · Organización · Ejecución · Seguimiento de viajes
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Kpi label="Viajes" value={viajes} />
          <Kpi label="En curso" value={curso} />
          <Kpi label="Próximos" value={proximos} />
          {canEdit && (
            <button
              type="button"
              onClick={onCreate}
              className="rounded-lg border border-white/30 bg-white/20 px-4 py-2 text-sm font-extrabold text-white backdrop-blur hover:bg-white/30"
            >
              ✈ Crear Viaje
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-heading text-xl font-extrabold text-white">{value}</div>
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">
        {label}
      </div>
    </div>
  );
}
