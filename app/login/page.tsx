import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Ya autenticado → al tracker.
  if (await getSession()) redirect("/home");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Izquierda: imagen con marca superpuesta */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/imagen.jpg"
          alt="Mentes Creadoras"
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        {/* Velo sutil solo en bordes para legibilidad, sin lavar la imagen */}
        <div className="absolute inset-0 bg-linear-to-t from-[#0f1623]/85 via-[#0f1623]/10 to-transparent" />
        <div className="absolute bottom-0 left-0 p-10">
          <h2 className="text-3xl font-bold leading-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.7)]">
            Construye tus hábitos,
            <br />
            crea tu mejor versión.
          </h2>
          <p className="mt-2 max-w-sm text-sm text-white/70">
            Seguimiento diario y reportes de cumplimiento.
          </p>
        </div>
      </div>

      {/* Derecha: formulario */}
      <div className="relative flex items-center justify-center px-6 py-12">
        {/* Resplandor decorativo */}
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative w-full max-w-sm">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2.5 text-2xl font-bold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent">●</span>
              Mentes Creadoras
            </div>
            <h1 className="text-xl font-semibold">Bienvenido de nuevo</h1>
            <p className="mt-1 text-sm text-muted">Inicia sesión para continuar</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
