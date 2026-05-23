"use client";

import { useActionState, useState } from "react";
import { User, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { signIn, type LoginState } from "@/lib/actions/auth";

const initial: LoginState = {};

const inputCls =
  "w-full rounded-xl border border-border bg-surface-2 py-3 pl-11 pr-3 text-sm text-foreground " +
  "placeholder:text-muted/70 outline-none transition " +
  "focus:border-accent focus:ring-2 focus:ring-accent/30";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);
  const [showPass, setShowPass] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <div className="relative">
        <User size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          name="identifier"
          type="text"
          required
          placeholder="Usuario"
          autoComplete="username"
          className={inputCls}
        />
      </div>

      <div className="relative">
        <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          name="password"
          type={showPass ? "text" : "password"}
          required
          placeholder="Contraseña"
          autoComplete="current-password"
          className={`${inputCls} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShowPass((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {state.error && (
        <p className="flex items-center gap-2 rounded-lg bg-[#ec4899]/10 px-3 py-2 text-sm text-[#f9a8d4]">
          <AlertCircle size={16} /> {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-[#0f1623] shadow-lg shadow-accent/25 transition hover:shadow-accent/40 hover:brightness-105 disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
