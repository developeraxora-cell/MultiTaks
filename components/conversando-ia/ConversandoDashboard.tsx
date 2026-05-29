"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Bot,
  Brain,
  CheckCircle2,
  Loader2,
  MessageCircleHeart,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { RightDrawer } from "@/components/ui/RightDrawer";
import {
  acceptBlockage,
  continueEmotionalChat,
  createWeeklyCheckIn,
  includeTransformationHabit,
  loadBlockageTracking,
  refreshConversandoInsight,
  saveGuidedEmotionalConversation,
} from "@/lib/actions/conversando-ia";
import type {
  BlockagePlan,
  BlockageProgress,
  EmotionalChatMessage,
  EmotionalConversation,
  EmotionalExtraction,
  PatternInsight,
  WeeklyCheckIn,
} from "@/lib/conversando-ia/types";
import {
  MAX_ACTIVE_BLOCKAGES,
  RESOLUTION_SUCCESS_PCT,
  RESOLUTION_WINDOW_DAYS,
} from "@/lib/conversando-ia/types";

interface BlockageTracking {
  plan: BlockagePlan;
  progress: BlockageProgress;
  checkIns: WeeklyCheckIn[];
  canCheckIn: boolean;
  nextCheckInInDays: number;
}

type LocalMessage = EmotionalChatMessage;

/** Altura máxima del input de chat: ~2 líneas; luego hace scroll. */
const INPUT_MAX_PX = 68;

const EMPTY_EXTRACTION: EmotionalExtraction = {
  situation: "",
  emotion: "",
  intensity: null,
  body_sensation: "",
  possible_trigger: "",
  automatic_thought: "",
  behavior_impulse: "",
  life_area: null,
};

export function ConversandoDashboard({
  conversations,
  initialInsight,
  plans,
  progressByPlan,
  userName,
  includedHabitTitles,
}: {
  conversations: EmotionalConversation[];
  initialInsight: PatternInsight;
  plans: BlockagePlan[];
  progressByPlan: Record<string, BlockageProgress>;
  userName: string;
  includedHabitTitles: string[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"dashboard" | "chat">("dashboard");
  const [selectedConversation, setSelectedConversation] = useState<EmotionalConversation | null>(null);
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [extraction, setExtraction] = useState<EmotionalExtraction>(EMPTY_EXTRACTION);
  const [readyToAnalyze, setReadyToAnalyze] = useState(false);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [insight, setInsight] = useState(initialInsight);
  const [drawerMode, setDrawerMode] = useState<"setup" | "progress" | null>(null);
  const [setupPlan, setSetupPlan] = useState<BlockagePlan | null>(null);
  const [tracking, setTracking] = useState<BlockageTracking | null>(null);
  const [busyBlockageId, setBusyBlockageId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [isMobile, setIsMobile] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function autoGrowInput(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_PX)}px`;
  }

  function resetInputHeight() {
    if (inputRef.current) inputRef.current.style.height = "auto";
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, summary]);

  const visibleConversation = selectedConversation ?? conversations[0] ?? null;


  function startChat() {
    const greeting = `${greetingForNow()} ${firstName(userName)}, soy Baymax. ¿Cómo te encuentras el día de hoy?`;
    setMessages([{ role: "assistant", content: greeting, at: new Date().toISOString() }]);
    setExtraction(EMPTY_EXTRACTION);
    setReadyToAnalyze(false);
    setSummary("");
    setText("");
    setView("chat");
  }

  function sendMessage(value = text) {
    const clean = value.trim();
    if (!clean || pending) return;

    const userMessage: LocalMessage = { role: "user", content: clean, at: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setText("");
    resetInputHeight();

    startTransition(async () => {
      try {
        const turn = await continueEmotionalChat({
          messages: nextMessages,
          extraction,
        });
        const assistantMessage: LocalMessage = {
          role: "assistant",
          content: turn.assistant_message,
          at: new Date().toISOString(),
        };
        setMessages((items) => [...items, assistantMessage]);
        setExtraction(turn.extraction);
        setReadyToAnalyze(turn.ready_to_analyze);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo responder con Baymax");
      }
    });
  }

  function analyzeConversation() {
    startTransition(async () => {
      try {
        const result = await saveGuidedEmotionalConversation({
          messages,
          situation: extraction.situation,
          emotion: extraction.emotion,
          intensity: extraction.intensity ?? 5,
          body_sensation: extraction.body_sensation,
          possible_trigger: extraction.possible_trigger,
          automatic_thought: extraction.automatic_thought,
          behavior_impulse: extraction.behavior_impulse,
          life_area: extraction.life_area ?? "salud",
        });
        setSummary(result);
        setMessages((items) => [
          ...items,
          { role: "assistant", content: result, at: new Date().toISOString() },
        ]);
        toast.success("Conversación guardada");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo analizar la conversación");
      }
    });
  }

  function refreshInsight() {
    startTransition(async () => {
      try {
        const next = await refreshConversandoInsight();
        setInsight(next);
        toast.success("Lectura actualizada");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
      }
    });
  }

  function startTransformation(planId: string) {
    setBusyBlockageId(planId);
    startTransition(async () => {
      try {
        const plan = await acceptBlockage(planId);
        setSetupPlan(plan);
        setDrawerMode("setup");
        toast.success("Etapa de transformación lista");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo iniciar la transformación");
      } finally {
        setBusyBlockageId(null);
      }
    });
  }

  function openProgress(planId: string) {
    setBusyBlockageId(planId);
    startTransition(async () => {
      try {
        const data = await loadBlockageTracking(planId);
        setTracking(data);
        setDrawerMode("progress");
        if (data.plan.status === "completed") router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo abrir el seguimiento");
      } finally {
        setBusyBlockageId(null);
      }
    });
  }

  async function submitWeeklyCheckIn(planId: string, score: number, notes: string): Promise<void> {
    const fd = new FormData();
    fd.set("plan_id", planId);
    fd.set("intensity_score", String(score));
    fd.set("notes", notes);
    await createWeeklyCheckIn(fd);
    const data = await loadBlockageTracking(planId);
    setTracking(data);
    router.refresh();
  }

  function closeDrawer() {
    setDrawerMode(null);
    setSetupPlan(null);
    setTracking(null);
  }

  async function includeHabit(title: string): Promise<"created" | "exists"> {
    try {
      const res = await includeTransformationHabit({
        title,
        category: "desarrollo_personal",
        blockagePlanId: setupPlan?.id,
      });
      if (res.status === "exists") {
        toast.info("Este hábito ya estaba registrado");
      } else {
        toast.success("Hábito incluido");
      }
      return res.status;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo incluir el hábito");
      throw e;
    }
  }

  function openConversation(conversation: EmotionalConversation) {
    setSelectedConversation(conversation);
    if (window.innerWidth < 1024) {
      setConversationDrawerOpen(true);
    }
  }

  if (view === "chat") {
    const analyzeButton = readyToAnalyze ? (
      <button
        type="button"
        onClick={analyzeConversation}
        disabled={pending || Boolean(summary)}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-[#0f1623] disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        {summary ? "Registrada" : "Analizar conversación"}
      </button>
    ) : null;

    const chatBody = (
      <>
        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto bg-[#101827] p-4">
          {messages.map((message, index) => (
            <div
              key={`${message.at}-${index}`}
              className={`flex animate-[chatIn_180ms_ease-out] items-end gap-2 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <span className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
                  <Bot size={16} />
                </span>
              )}
              <div className="max-w-[86%]">
                {message.role === "assistant" && (
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-muted">
                    <Sparkles size={12} className="text-accent" /> Baymax
                  </p>
                )}
                <div
                  className={`whitespace-pre-wrap px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                    message.role === "user"
                      ? "rounded-2xl rounded-br-md bg-accent text-[#0f1623] shadow-accent/10"
                      : "rounded-2xl rounded-bl-md border border-border bg-surface-2 text-foreground"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex animate-[chatIn_180ms_ease-out] items-end gap-2">
              <span className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
                <Bot size={16} />
              </span>
              <div className="rounded-2xl rounded-bl-md border border-border bg-surface-2 px-3.5 py-3 text-sm text-muted">
                <span className="inline-flex translate-y-0.5 gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {readyToAnalyze && !summary && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted">
            Ya tengo lo principal para registrar este momento. Puedes seguir conversando o analizarlo ahora.
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
          className="flex items-end gap-2 border-t border-border p-3"
        >
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            onChange={(event) => {
              setText(event.target.value);
              autoGrowInput(event.target);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Escribe con calma..."
            className="scroll-thin min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm leading-6 outline-none focus:border-accent/60"
            style={{ maxHeight: INPUT_MAX_PX }}
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-[#0f1623] disabled:opacity-50"
            aria-label="Enviar"
          >
            <Send size={16} />
          </button>
        </form>
      </>
    );

    if (isMobile) {
      return (
        <RightDrawer
          open
          onClose={() => setView("dashboard")}
          title="Baymax"
          headerActions={analyzeButton}
          bodyClassName="flex min-h-0 flex-1 flex-col"
        >
          {chatBody}
        </RightDrawer>
      );
    }

    return (
      <div className="flex h-[calc(100vh-150px)] min-h-140 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/35 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
              <Bot size={22} />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface bg-accent" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">Baymax</h2>
              <p className="truncate text-sm text-muted">Conversación privada para observar tu momento actual.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {analyzeButton}
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface-2 text-muted hover:text-foreground"
              aria-label="Cerrar chat"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {chatBody}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conversando IA</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Guía de autoconocimiento emocional y hábitos. Registra momentos, observa patrones y trabaja uno o dos
            bloqueos a la vez sin diagnósticos médicos.
          </p>
        </div>
        <button
          type="button"
          onClick={startChat}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-[#0f1623]"
        >
          <MessageCircleHeart size={16} /> Registrar lo que siento
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Archive size={18} className="text-accent" /> Historial de conversaciones ({conversations.length})
          </h2>
          <div className="space-y-2">
            {conversations.length === 0 && <p className="text-sm text-muted">Todavía no hay conversaciones guardadas.</p>}
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => openConversation(conversation)}
                className="w-full rounded-xl border border-border bg-surface-2 p-3 text-left text-sm hover:border-accent/50"
              >
                <p className="font-medium">{conversation.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{conversation.ai_summary ?? "Sin resumen"}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="hidden rounded-2xl border border-border bg-surface p-4 lg:block">
          {visibleConversation ? (
            <>
              <h2 className="mb-3 text-base font-semibold">{visibleConversation.title}</h2>
              <ConversationTranscript conversation={visibleConversation} maxHeightClass="max-h-[420px]" />
            </>
          ) : (
            <p className="text-sm text-muted">Selecciona una conversación para revisarla.</p>
          )}
        </div>
      </section>

      <RightDrawer
        open={conversationDrawerOpen}
        onClose={() => setConversationDrawerOpen(false)}
        title={selectedConversation?.title ?? "Conversación"}
      >
        {selectedConversation && (
          <ConversationTranscript conversation={selectedConversation} maxHeightClass="max-h-none" />
        )}
      </RightDrawer>

      <RightDrawer
        open={drawerMode !== null}
        onClose={closeDrawer}
        title={drawerMode === "progress" ? "Seguimiento del bloqueo" : "Etapa de transformación"}
      >
        {drawerMode === "setup" && setupPlan && (
          <TransformationDrawerContent
            plan={setupPlan}
            includedHabitTitles={includedHabitTitles}
            onInclude={includeHabit}
          />
        )}
        {drawerMode === "progress" && tracking && (
          <BlockageProgressContent tracking={tracking} onSubmitCheckIn={submitWeeklyCheckIn} />
        )}
      </RightDrawer>

      <section>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Brain size={20} className="text-accent" />
              <h2 className="text-base font-semibold">Lectura de patrones</h2>
            </div>
            <button
              type="button"
              onClick={refreshInsight}
              disabled={pending}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface-2 text-muted hover:text-foreground disabled:opacity-60"
              aria-label="Actualizar lectura"
            >
              {pending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{insight.message}</p>

          {insight.phase === "full_analysis" && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InsightList title="Emociones repetidas" items={insight.repeated_emotions} />
              <InsightList title="Detonantes frecuentes" items={insight.frequent_triggers} />
              <InsightList title="Sensaciones corporales" items={insight.body_sensations} />
              <InsightList title="Conductas automáticas" items={insight.automatic_behaviors} />
              <InsightList title="Creencias posibles" items={insight.possible_beliefs} />
            </div>
          )}

          {plans.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Sparkles size={15} className="text-accent" /> Bloqueos detectados
              </h3>
              <p className="mb-3 text-xs text-muted">
                Trabaja máximo {MAX_ACTIVE_BLOCKAGES} bloqueos a la vez. Empieza la transformación del que más te afecte.
              </p>
              <div className="space-y-2">
                {plans.map((plan) => (
                  <BlockageCard
                    key={plan.id}
                    plan={plan}
                    progress={progressByPlan[plan.id] ?? null}
                    busy={busyBlockageId === plan.id && pending}
                    onStart={() => startTransformation(plan.id)}
                    onOpenProgress={() => openProgress(plan.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

      </section>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {items.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Sin suficientes datos todavía.</p>
      )}
    </div>
  );
}

function ConversationTranscript({
  conversation,
  maxHeightClass,
}: {
  conversation: EmotionalConversation;
  maxHeightClass: string;
}) {
  return (
    <div className={`scroll-thin space-y-2 overflow-y-auto pr-1 ${maxHeightClass}`}>
      {conversation.messages.map((message, index) => (
        <div
          key={`${conversation.id}-${index}`}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <p
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
              message.role === "user"
                ? "bg-accent text-[#0f1623]"
                : "border border-border bg-surface-2 text-foreground"
            }`}
          >
            {message.content}
          </p>
        </div>
      ))}
      {conversation.ai_summary && (
        <>
          <div className="py-2">
            <div className="border-t border-border" />
          </div>
          <div className="flex justify-start">
            <div className="max-w-[85%]">
              <p className="mb-1 flex items-center gap-1.5 text-xs text-muted">
                <Sparkles size={12} className="text-accent" /> Baymax · análisis
              </p>
              <p className="whitespace-pre-wrap rounded-2xl rounded-bl-md border border-border bg-surface-2 px-3 py-2 text-sm leading-6 text-foreground">
                {conversation.ai_summary}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TransformationDrawerContent({
  plan,
  includedHabitTitles,
  onInclude,
}: {
  plan: BlockagePlan;
  includedHabitTitles: string[];
  onInclude: (title: string) => Promise<"created" | "exists">;
}) {
  const [loadingTitle, setLoadingTitle] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Set<string>>(
    () => new Set(includedHabitTitles.map((t) => t.trim())),
  );

  const habits = [
    { label: "Hábito diario", title: plan.daily_habit ?? "" },
    { label: "Acción real", title: plan.real_action ?? "" },
    { label: "Audio sugerido", title: plan.audio_suggestion ? `Escuchar: ${plan.audio_suggestion}` : "" },
    { label: "Afirmación", title: plan.affirmation ? `Repetir afirmación: ${plan.affirmation}` : "" },
  ].filter((item) => item.title.trim().length > 0);

  async function handleInclude(title: string) {
    setLoadingTitle(title);
    try {
      await onInclude(title);
      setRegistered((prev) => new Set(prev).add(title.trim()));
    } catch {
      // toast handled upstream
    } finally {
      setLoadingTitle(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface-2 p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Bloqueo prioritario</p>
        <h3 className="mt-1 text-lg font-semibold">{plan.title}</h3>
        {plan.description && <p className="mt-2 text-sm leading-6 text-muted">{plan.description}</p>}
        {plan.possible_belief && (
          <p className="mt-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
            Creencia posible: {plan.possible_belief}
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Hábitos recomendados para incluir</h3>
        <div className="space-y-2">
          {habits.map((habit) => {
            const isRegistered = registered.has(habit.title.trim());
            const isLoading = loadingTitle === habit.title;
            return (
              <div key={habit.label} className="rounded-xl border border-border bg-surface-2 p-3">
                <p className="text-xs uppercase tracking-wide text-muted">{habit.label}</p>
                <p className="mt-1 text-sm leading-6 text-foreground">{habit.title}</p>
                {isRegistered ? (
                  <span className="mt-3 inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
                    <CheckCircle2 size={14} />
                    Hábito registrado
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInclude(habit.title)}
                    disabled={isLoading}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-[#0f1623] disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Incluir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {plan.followup_question && (
        <div className="rounded-2xl border border-border bg-surface-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Seguimiento semanal</p>
          <p className="mt-1 text-sm leading-6 text-foreground">{plan.followup_question}</p>
        </div>
      )}
    </div>
  );
}

function BlockageCard({
  plan,
  progress,
  busy,
  onStart,
  onOpenProgress,
}: {
  plan: BlockagePlan;
  progress: BlockageProgress | null;
  busy: boolean;
  onStart: () => void;
  onOpenProgress: () => void;
}) {
  const resolvedLabel = plan.resolved_at
    ? new Date(plan.resolved_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })
    : null;

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{plan.title}</p>
          {plan.possible_belief && (
            <p className="mt-1 line-clamp-2 text-xs text-muted">Creencia posible: {plan.possible_belief}</p>
          )}
        </div>
        {plan.status === "active" && progress && (
          <span className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
            {progress.overall_pct}%
          </span>
        )}
      </div>

      {plan.status === "active" && progress && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min(100, progress.overall_pct)}%` }}
          />
        </div>
      )}

      <div className="mt-3">
        {plan.status === "proposed" && (
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-[#0f1623] disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Empezar transformación
          </button>
        )}
        {plan.status === "active" && (
          <button
            type="button"
            onClick={onOpenProgress}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:border-accent/50 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
            Ver seguimiento
          </button>
        )}
        {plan.status === "completed" && (
          <span className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
            <CheckCircle2 size={14} />
            Bloqueo resuelto{resolvedLabel ? ` · ${resolvedLabel}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function BlockageProgressContent({
  tracking,
  onSubmitCheckIn,
}: {
  tracking: BlockageTracking;
  onSubmitCheckIn: (planId: string, score: number, notes: string) => Promise<void>;
}) {
  const { plan, progress, checkIns, canCheckIn, nextCheckInInDays } = tracking;
  const [score, setScore] = useState(5);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmitCheckIn(plan.id, score, notes.trim());
      setNotes("");
      toast.success("Comentario semanal guardado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el comentario");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface-2 p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Bloqueo en seguimiento</p>
        <h3 className="mt-1 text-lg font-semibold">{plan.title}</h3>
        {plan.status === "completed" ? (
          <p className="mt-2 inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
            <CheckCircle2 size={15} /> Resuelto ({RESOLUTION_SUCCESS_PCT}% durante {RESOLUTION_WINDOW_DAYS} días)
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Cumplimiento {progress.overall_pct}% · día {progress.days_tracked} de {RESOLUTION_WINDOW_DAYS}. Se marca
            resuelto al llegar a {RESOLUTION_SUCCESS_PCT}% sostenido {RESOLUTION_WINDOW_DAYS} días.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Progreso de tus hábitos</h3>
        {progress.habits.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted">
            Este bloqueo todavía no tiene hábitos incluidos. Inclúyelos desde la etapa de transformación para medir tu
            avance.
          </p>
        ) : (
          <div className="space-y-2">
            {progress.habits.map((habit) => (
              <div key={habit.task_id} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 text-sm text-foreground">{habit.title}</p>
                  <span className="shrink-0 text-xs font-semibold text-accent">{habit.pct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.min(100, habit.pct)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {habit.completed} de {habit.eligible} días cumplidos
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {plan.status === "active" && (
        <div className="rounded-2xl border border-border bg-surface-2 p-4">
          <h3 className="text-sm font-semibold">Comentario semanal</h3>
          {plan.followup_question && (
            <p className="mt-1 text-sm leading-6 text-muted">{plan.followup_question}</p>
          )}
          {canCheckIn ? (
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-muted">
                Del 1 al 10, ¿qué tanto sientes que este bloqueo sigue dominando tu vida?
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="mt-2 w-full accent-accent"
                />
                <span className="mt-1 block text-sm font-semibold text-foreground">{score} / 10</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="¿Cómo te fue con este bloqueo durante la semana?"
                rows={3}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-[#0f1623] disabled:opacity-60"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Guardar comentario
              </button>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
              El comentario semanal se habilita una vez por semana. Disponible en {nextCheckInInDays}{" "}
              {nextCheckInInDays === 1 ? "día" : "días"}.
            </p>
          )}
        </div>
      )}

      {checkIns.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Historial de seguimiento</h3>
          <div className="space-y-2">
            {[...checkIns].reverse().map((checkIn) => (
              <div key={checkIn.id} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">
                    {new Date(checkIn.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                  </span>
                  <span className="text-xs font-semibold text-foreground">Intensidad {checkIn.intensity_score}/10</span>
                </div>
                {checkIn.notes && <p className="mt-1 text-sm text-foreground">{checkIn.notes}</p>}
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
                  <Sparkles size={12} className="mt-0.5 shrink-0 text-accent" /> {checkIn.ai_reply}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "amigo";
}
