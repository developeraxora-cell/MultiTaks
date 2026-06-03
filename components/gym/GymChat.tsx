"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  Dumbbell,
  Sparkles,
  ListPlus,
  Check,
  ArrowRight,
  X,
} from "lucide-react";

import { createRoutineFromProposal, sendGymChatMessage } from "@/lib/actions/gym";
import { muscleGroupLabel } from "@/lib/gym/types";
import type { GymChatMessage, RoutineProposal } from "@/lib/gym/types";

const SUGGESTIONS = [
  "Arma una rutina de pecho y tríceps",
  "Arma una rutina de pierna",
  "¿Cómo mejoro mi press de banca?",
  "Estoy estancado, ¿qué hago?",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
  proposal?: RoutineProposal | null;
}

export function GymChat({
  initial,
  closeHref,
}: {
  initial: GymChatMessage[];
  /** En móvil el chat es pantalla completa; la X cierra y va a este enlace. */
  closeHref?: string;
}) {
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
        const { reply, proposal } = await sendGymChatMessage(msg);
        setMessages((m) => [...m, { role: "assistant", content: reply, proposal }]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al enviar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface lg:static lg:z-auto lg:min-h-0 lg:flex-1 lg:rounded-3xl lg:border lg:border-border">
      {/* Cabecera coach */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-2/40 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:pt-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent">
          <Dumbbell size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Coach IA</p>
          <p className="flex items-center gap-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> En línea
          </p>
        </div>
        {closeHref && (
          <Link
            href={closeHref}
            aria-label="Cerrar chat"
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground lg:hidden"
          >
            <X size={20} />
          </Link>
        )}
      </div>

      {/* Mensajes */}
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <span className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent">
              <Sparkles size={26} />
            </span>
            <p className="text-sm font-medium">Tu entrenador personal</p>
            <p className="mt-1 text-sm text-muted">
              Pídeme una rutina y la creo lista para entrenar, o pregúntame sobre técnica y progresión.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-left text-xs text-muted hover:border-accent/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}

        {pending && (
          <div className="flex items-end gap-2">
            <CoachAvatar />
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
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
          placeholder="Escribe tu pregunta o pide una rutina…"
          className="flex-1 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent/60"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-[#0f1623] disabled:opacity-50"
          aria-label="Enviar"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}

function CoachAvatar() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
      <Dumbbell size={15} />
    </span>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-sm text-[#0f1623]">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <CoachAvatar />
      <div className="max-w-[85%] space-y-2">
        <div className="rounded-2xl rounded-bl-sm border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground">
          <Markdown text={msg.content} />
        </div>
        {msg.proposal && msg.proposal.exercises.length > 0 && (
          <ProposalCard proposal={msg.proposal} />
        )}
      </div>
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: RoutineProposal }) {
  const [pending, startTransition] = useTransition();
  const [createdId, setCreatedId] = useState<string | null>(null);

  function create() {
    startTransition(async () => {
      try {
        const id = await createRoutineFromProposal(proposal);
        setCreatedId(id);
        toast.success("Rutina creada");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo crear");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-surface p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={15} className="text-accent" />
        <p className="text-sm font-semibold">{proposal.name}</p>
      </div>
      {proposal.objective && (
        <p className="mb-2 text-xs text-muted">Objetivo: {proposal.objective}</p>
      )}
      <ul className="mb-3 space-y-1">
        {proposal.exercises.map((e, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              {i + 1}. {e.name}
              <span className="ml-1 text-xs text-muted">{muscleGroupLabel(e.muscle_group)}</span>
            </span>
            <span className="shrink-0 text-xs text-muted">
              {e.target_sets} × {e.target_reps ?? "—"}
            </span>
          </li>
        ))}
      </ul>

      {createdId ? (
        <Link
          href={`/gimnasio/rutinas/${createdId}`}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent/40 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10"
        >
          <Check size={15} /> Rutina creada · Ver <ArrowRight size={14} />
        </Link>
      ) : (
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-[#0f1623] hover:brightness-105 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ListPlus size={15} />
          )}
          {pending ? "Creando…" : "Agregar a mis rutinas"}
        </button>
      )}
    </div>
  );
}

/**
 * Render markdown ligero (sin dependencias): **negrita**, listas con - / *
 * o numeradas, y párrafos. Suficiente para las respuestas del coach.
 */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items;
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="ml-4 list-decimal space-y-0.5">
          {items.map((it, i) => (
            <li key={i}>{inline(it)}</li>
          ))}
        </ol>
      ) : (
        <ul key={blocks.length} className="ml-4 list-disc space-y-0.5">
          {items.map((it, i) => (
            <li key={i}>{inline(it)}</li>
          ))}
        </ul>
      ),
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const ordered = /^\s*\d+[.)]\s+/.exec(line);
    const bullet = /^\s*[-*]\s+/.exec(line);
    if (ordered) {
      if (!list || !list.ordered) {
        flush();
        list = { ordered: true, items: [] };
      }
      list.items.push(line.replace(/^\s*\d+[.)]\s+/, ""));
    } else if (bullet) {
      if (!list || list.ordered) {
        flush();
        list = { ordered: false, items: [] };
      }
      list.items.push(line.replace(/^\s*[-*]\s+/, ""));
    } else {
      flush();
      if (line.trim() === "") continue;
      blocks.push(
        <p key={blocks.length} className="whitespace-pre-wrap">
          {inline(line)}
        </p>,
      );
    }
  }
  flush();

  return <div className="space-y-1.5">{blocks}</div>;
}

/** Procesa **negrita** dentro de una línea. */
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(p);
    if (bold) return <strong key={i} className="font-semibold text-foreground">{bold[1]}</strong>;
    return <span key={i}>{p}</span>;
  });
}
