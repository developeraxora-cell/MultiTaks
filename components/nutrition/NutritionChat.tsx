"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Loader2, Sparkles } from "lucide-react";

import { sendNutritionChatMessage } from "@/lib/actions/nutrition";
import type { NutritionChatMessage } from "@/lib/nutrition/types";

const SUGGESTIONS = [
  "¿Qué puedo cenar si me quedan 500 calorías?",
  "¿Qué comida alta en proteína puedo preparar?",
  "¿Qué debería mejorar de mi alimentación esta semana?",
  "¿Qué puedo comer antes de entrenar?",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function NutritionChat({ initial }: { initial: NutritionChatMessage[] }) {
  const [messages, setMessages] = useState<Msg[]>(
    initial.map((m) => ({ role: m.role, content: m.content })),
  );
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function send(message: string) {
    const msg = message.trim();
    if (!msg || pending) return;
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setText("");
    startTransition(async () => {
      try {
        const reply = await sendNutritionChatMessage(msg);
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al enviar");
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col rounded-3xl border border-border bg-surface">
      {/* Mensajes */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <Sparkles size={28} className="mx-auto text-emerald-300" />
            <p className="mt-2 text-sm text-muted">
              Pregúntame sobre tu alimentación. Uso tu perfil, metas y comidas del día como contexto.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-left text-xs text-muted hover:border-emerald-400/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-emerald-500 text-[#0f1623]"
                  : "border border-border bg-surface-2 text-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Escribiendo…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe tu pregunta…"
          className="flex-1 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-400/60"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-[#0f1623] disabled:opacity-50"
          aria-label="Enviar"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}
