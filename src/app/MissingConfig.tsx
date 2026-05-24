export function MissingConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-l px-4">
      <div className="w-full max-w-lg rounded-card border border-rust/40 bg-white p-8 shadow-md">
        <h1 className="font-heading text-2xl font-bold text-dark">
          Falta configurar <span className="text-rust">Supabase</span>
        </h1>
        <p className="mt-2 text-sm text-dark-2">
          La app necesita las credenciales de tu proyecto Supabase para arrancar.
        </p>

        <ol className="mt-6 space-y-3 text-sm text-dark">
          <li>
            <span className="font-semibold">1.</span> En la raíz del proyecto, copia el archivo
            de ejemplo:
            <pre className="mt-2 overflow-x-auto rounded-md border border-sand bg-sand-l p-3 font-mono text-xs">
              copy .env.example .env
            </pre>
          </li>
          <li>
            <span className="font-semibold">2.</span> Abre el nuevo <code>.env</code> y pega tus
            valores de Supabase (Settings → API):
            <pre className="mt-2 overflow-x-auto rounded-md border border-sand bg-sand-l p-3 font-mono text-xs">
{`VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY`}
            </pre>
          </li>
          <li>
            <span className="font-semibold">3.</span> Reinicia el dev server:
            <pre className="mt-2 overflow-x-auto rounded-md border border-sand bg-sand-l p-3 font-mono text-xs">
              npm run dev
            </pre>
          </li>
        </ol>

        <p className="mt-6 text-xs text-dark-3">
          Vite sólo lee las variables <code>VITE_*</code> al arrancar. Después de editar
          <code> .env</code> necesitas reiniciar el comando.
        </p>
      </div>
    </div>
  );
}
