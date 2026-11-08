import { NavLink } from 'react-router-dom';
import { puede, useAuth } from '@/lib/auth';

/**
 * Las secciones del módulo.
 *
 * La liquidación del piloto NO cuelga de una aeronave --un piloto la llena por
 * viaje, y el viaje puede tocar más de una-- así que vive al lado de la flota
 * y no dentro de una matrícula. Al principio era un botón pequeño junto al
 * título y la usuaria no lo encontró: pidió «una sección», y una sección se
 * ve como una sección.
 *
 * El piloto que entre solo con su módulo no ve «Flota»: no la alcanza.
 */
export function NavAeronaves() {
  const { profile } = useAuth();
  const verFlota = puede(profile, 'aeronaves');

  const secciones = [
    ...(verFlota ? [{ to: '/aeronaves', label: '✈ Flota', end: true }] : []),
    { to: '/aeronaves/liquidaciones', label: '🧾 Liquidación del piloto', end: false },
  ];

  // Con una sola sección no hay nada que escoger, y una pestaña sola es ruido.
  if (secciones.length < 2) return null;

  return (
    <nav className="flex flex-wrap gap-1 border-b border-sand">
      {secciones.map((s) => (
        <NavLink
          key={s.to}
          to={s.to}
          end={s.end}
          className={({ isActive }) =>
            `-mb-px border-b-2 px-4 py-2.5 text-sm font-extrabold transition ${
              isActive
                ? 'border-teal text-teal-d'
                : 'border-transparent text-dark-3 hover:border-sand hover:text-dark-2'
            }`
          }
        >
          {s.label}
        </NavLink>
      ))}
    </nav>
  );
}
