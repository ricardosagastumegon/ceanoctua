import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-d disabled:opacity-60"
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
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
