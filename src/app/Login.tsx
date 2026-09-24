import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /**
   * Restablecer la contraseña.
   *
   * No existe «ver la contraseña»: se guardan cifradas de un solo sentido y no
   * hay forma de recuperarlas, ni desde aquí ni desde Supabase. Lo único
   * posible es mandar un correo con un enlace para poner una nueva.
   *
   * Ojo: esto exige que el correo del usuario sea real. Una cuenta creada con
   * una dirección interna que no existe -- el caso del presidente -- solo la
   * puede restablecer el administrador desde el panel de Supabase.
   */
  async function recuperar() {
    const correo = email.trim();
    if (!correo) {
      setError('Escribe tu correo arriba y vuelve a tocar el enlace.');
      return;
    }
    setError(null);
    setAviso(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/nueva-clave`,
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setAviso(
      `Si ${correo} tiene una cuenta, le llegará un correo con el enlace para poner una contraseña nueva. Revisa también la carpeta de no deseados.`,
    );
  }

  if (loading) return <Splash />;
  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (err) setError(err);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-l px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-card border border-sand bg-white p-8 shadow-md"
      >
        <h1 className="font-heading text-2xl font-bold text-dark">
          Board <span className="text-teal">Assistant</span>
        </h1>
        <p className="mt-1 text-sm text-dark-2">Inicia sesión para continuar.</p>

        <label className="mt-6 block text-xs font-semibold uppercase tracking-wider text-dark-2">
          Correo
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-sand bg-sand-l/40 px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </label>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-dark-2">
          Contraseña
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-sand bg-sand-l/40 px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">
            {error}
          </p>
        )}

        {aviso && (
          <p className="mt-4 rounded-md border border-teal/30 bg-teal-l px-3 py-2 text-sm text-teal-d">
            {aviso}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-d disabled:opacity-60"
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>

        <button
          type="button"
          onClick={() => void recuperar()}
          disabled={submitting}
          className="mt-4 w-full text-center text-xs font-semibold text-teal-d underline disabled:opacity-60"
        >
          Olvidé mi contraseña
        </button>

        <p className="mt-6 text-xs text-dark-3">
          ¿No tienes acceso? Contacta al administrador.
        </p>
      </form>
    </div>
  );
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-l">
      <span className="text-sm text-dark-2">Cargando…</span>
    </div>
  );
}
