/** Aviso mostrado cuando faltan las variables de entorno de Supabase. */
export function SetupNotice() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold">Configura Supabase</h1>
        <p className="mt-2 text-sm text-muted">
          Para usar la app, crea un proyecto en Supabase y define estas variables en{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5">.env.local</code>:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">
{`SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...`}
        </pre>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Project Settings → API: copia la URL y la <em>service_role</em> key.</li>
          <li>
            SQL Editor → pega y ejecuta el contenido de{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5">supabase/schema.sql</code>.
          </li>
          <li>Reinicia el servidor de desarrollo.</li>
        </ol>
      </div>
    </div>
  );
}
