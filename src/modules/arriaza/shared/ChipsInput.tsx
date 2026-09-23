/**
 * Lista de valores que se van agregando como chips.
 *
 * Nació dentro del formulario de ticket aéreo para los PNR y los pasajeros;
 * vive aquí porque Actividades necesita lo mismo para sus participantes, con
 * dos diferencias: los nombres no van en mayúsculas ni en monoespaciado, y
 * los chips toman el color del servicio que los monta.
 */
type Props = {
  label: string;
  placeholder: string;
  draft: string;
  onDraft: (v: string) => void;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  /** Códigos como PNR o aeropuertos: mayúsculas y monoespaciado. */
  mono?: boolean;
  /** Colores del servicio. Sin esto, el teal de siempre. */
  color?: { solid: string; dark: string; light: string };
};

export function ChipsInput({
  label, placeholder, draft, onDraft, items, onAdd, onRemove, mono, color,
}: Props) {
  function add() {
    // Los códigos se normalizan a mayúsculas; los nombres propios no.
    const v = mono ? draft.trim().toUpperCase() : draft.trim();
    if (!v) return;
    onAdd(v);
    onDraft('');
  }

  const chipStyle = color ? { backgroundColor: color.light, color: color.dark } : undefined;
  const botonStyle = color ? { borderColor: `${color.solid}66`, color: color.dark } : undefined;

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-dark-2">{label}</div>
      <div className="mt-1 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          // Se agrega también al salir del campo: escribir el valor y guardar
          // sin presionar "Agregar" lo perdía en silencio.
          onBlur={add}
          placeholder={placeholder}
          className={`block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal ${mono ? 'font-mono' : ''}`}
        />
        <button
          type="button"
          onClick={add}
          style={botonStyle}
          className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold ${color ? 'hover:opacity-80' : 'border-teal/40 text-teal-d hover:bg-teal-l'}`}
        >
          ＋ Agregar
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((v, i) => (
            <li
              key={`${v}-${i}`}
              style={chipStyle}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold ${mono ? 'font-mono' : ''} ${color ? '' : 'bg-teal-l text-teal-d'}`}
            >
              {v}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="opacity-60 hover:text-rust hover:opacity-100"
                aria-label={`Quitar ${v}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
