import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * Poner una contraseña nueva.
 *
 * Sirve para dos caminos que terminan igual:
 *
 *  - Se llegó desde el enlace del correo de recuperación. Supabase deja una
 *    sesión temporal al abrirlo, y con ella se puede cambiar la contraseña.
 *  - Se entró normal y se quiere cambiar la propia, desde el menú de arriba.
 *
 * En ninguno de los dos se muestra la contraseña anterior: no existe forma de
 * leerla, están cifradas de un solo sentido.
 */
export default function NuevaClave() {
  const navigate = useNavigate();
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [haySesion, setHaySesion] = useState<boolean | null>(null);

  useEffect(() => {
    // El enlace del correo trae el token en la URL y el cliente lo canjea
    // solo; basta con esperar a que la sesión aparezca.
    void supabase.auth.getSession().then(({ data }) => setHaySesion(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHaySesion(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (clave.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.');
      return;
    }
    if (clave !== repetida) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }
    setError(null);
    setGuardando(true);
    const { error: err } = await supabase.auth.updateUser({ password: clave });
    setGuardando(false);
    if (err) {
      setError(err.message);
      return;
    }
    setListo(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-l px-4">
      <div className="w-full max-w-sm rounded-card border border-sand bg-white p-8 shadow-md">
        <h1 className="font-heading text-2xl font-bold text-dark">
          Board <span className="text-teal">Assistant</span>
        </h1>

        {listo ? (
          <>
            <p className="mt-2 text-sm text-dark-2">
              Tu contraseña quedó guardada. Ya puedes usarla para entrar.
            </p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="mt-6 w-full rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white"
            >
              Continuar
            </button>
          </>
        ) : haySesion === false ? (
          <>
            <p className="mt-2 text-sm text-dark-2">
              Este enlace ya no sirve. Los correos de recuperación caducan al poco
              tiempo y solo se pueden usar una vez.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="mt-6 w-full rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white"
            >
              Pedir otro correo
            </button>
          </>
        ) : (
          <form onSubmit={guardar}>
            <p className="mt-1 text-sm text-dark-2">Escribe tu contraseña nueva.</p>

            <label className="mt-6 block text-xs font-semibold uppercase tracking-wider text-dark-2">
              Contraseña nueva
              <input
                type="password"
                required
                autoComplete="new-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className="mt-1 block w-full rounded-md border border-sand bg-sand-l/40 px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
              />
            </label>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-dark-2">
              Repítela
              <input
                type="password"
                required
                autoComplete="new-password"
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
                className="mt-1 block w-full rounded-md border border-sand bg-sand-l/40 px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
              />
            </label>

            {error && (
              <p className="mt-4 rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={guardando || haySesion === null}
              className="mt-6 w-full rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar contraseña'}
            </button>

            {/* Esta pantalla vive fuera del armazón con menú, y en la app
                instalada en el teléfono no hay botón de atrás del navegador:
                sin esto no habría forma de arrepentirse. */}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-3 w-full text-center text-xs font-semibold text-dark-3 underline"
            >
              Volver sin cambiarla
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
