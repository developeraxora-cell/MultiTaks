import "server-only";

import type {
  BlockagePlan,
  EmotionalChatMessage,
  EmotionalExtraction,
  EmotionalRecord,
  GuidedConversationTurn,
  LifeArea,
  PatternInsight,
} from "./types";

// Usa las mismas variables que el módulo Fitness/Nutrición para no duplicar config.
const API_KEY = process.env.AI_MODEL_API_KEY;
const BASE_URL = process.env.AI_MODEL_BASE_URL;
const MODEL_NAME = process.env.AI_MODEL_NAME;

export function isConversandoAiConfigured(): boolean {
  return Boolean(BASE_URL && MODEL_NAME);
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function chatCompletion(messages: ChatMessage[], json = false): Promise<string> {
  const url = `${BASE_URL!.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  const body = JSON.stringify({
    model: MODEL_NAME,
    messages,
    stream: false,
    temperature: optsTemperature(json),
    ...(json ? { response_format: { type: "json_object" } } : {}),
  });

  // Reintenta una vez ante fallo de red/timeout (cold start de la función serverless).
  // Timeout < maxDuration de Vercel para fallar a mock con tiempo, no morir sin respuesta.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`IA respondió ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Respuesta de IA vacía");
      return content;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Fallo al contactar la IA");
}

function optsTemperature(json: boolean): number {
  return json ? 0.15 : 0.35;
}

function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La IA no devolvió JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export function getObservationDays(records: EmotionalRecord[]): number {
  if (records.length === 0) return 0;
  const first = records.reduce((min, r) => (r.record_date < min ? r.record_date : min), records[0].record_date);
  const today = new Date();
  const start = new Date(`${first}T00:00:00`);
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, diff);
}

export async function buildPatternInsight(
  records: EmotionalRecord[],
  existingBlockages: string[] = [],
): Promise<PatternInsight> {
  const days = getObservationDays(records);
  if (days < 7) {
    const last = records[records.length - 1] ?? null;
    return {
      phase: "collecting",
      days_observed: days,
      records_count: records.length,
      message:
        records.length === 0
          ? "Aún no hay registros suficientes. Cuando guardes tu primer momento importante, aquí te mostraré un resumen suave de lo que se anotó sin sacar conclusiones."
          : buildCollectingMessage(records, last),
      repeated_emotions: compactTop(records.map((r) => r.emotion)),
      frequent_triggers: compactTop(records.map((r) => r.possible_trigger ?? r.situation)),
      body_sensations: compactTop(records.map((r) => r.body_sensation)),
      automatic_behaviors: compactTop(records.map((r) => r.behavior_impulse)),
      possible_beliefs: [],
      priority_blockages: [],
    };
  }

  if (isConversandoAiConfigured()) {
    try {
      return dedupeBlockages(normalizeInsight(await callRealModelInsight(records, days, existingBlockages)), existingBlockages);
    } catch {
      return dedupeBlockages(mockInsight(records, days), existingBlockages);
    }
  }
  await delay(350);
  return dedupeBlockages(mockInsight(records, days), existingBlockages);
}

/**
 * Quita de la lectura los bloqueos que ya se están trabajando o ya se
 * resolvieron, para que las nuevas lecturas no sean redundantes.
 */
function dedupeBlockages(insight: PatternInsight, existing: string[]): PatternInsight {
  if (existing.length === 0) return insight;
  const existingNorm = existing.map(normalizeComparable);
  const filtered = insight.priority_blockages.filter((b) => {
    const norm = normalizeComparable(b);
    return !existingNorm.some((e) => e.includes(norm) || norm.includes(e));
  });
  return { ...insight, priority_blockages: filtered };
}

export async function continueGuidedConversation({
  userName,
  messages,
  extraction,
}: {
  userName: string;
  messages: EmotionalChatMessage[];
  extraction: EmotionalExtraction;
}): Promise<GuidedConversationTurn> {
  const inferredExtraction = inferExtractionFromLastExchange(messages, extraction);

  if (isConversandoAiConfigured()) {
    try {
      const content = await chatCompletion(
        [
          { role: "system", content: guidedConversationSystemPrompt(userName) },
          {
            role: "user",
            content: JSON.stringify({
              previous_extraction: inferredExtraction,
              next_required_field: nextRequiredField(inferredExtraction),
              messages: messages.slice(-18),
              last_assistant_messages: messages
                .filter((message) => message.role === "assistant")
                .slice(-4)
                .map((message) => message.content),
            }),
          },
        ],
        true,
      );
      return normalizeGuidedTurn(
        extractJson<Partial<GuidedConversationTurn>>(content),
        inferredExtraction,
        messages,
      );
    } catch {
      return mockGuidedTurn(messages, inferredExtraction);
    }
  }

  await delay(250);
  return mockGuidedTurn(messages, inferredExtraction);
}

export async function buildTransformationPlan(
  records: EmotionalRecord[],
  insight: PatternInsight,
): Promise<Omit<BlockagePlan, "id" | "user_id" | "status" | "priority" | "resolved_at" | "started_at" | "last_checked_at" | "created_at" | "updated_at">> {
  if (isConversandoAiConfigured()) {
    try {
      const content = await chatCompletion(
        [
          { role: "system", content: planSystemPrompt() },
          { role: "user", content: JSON.stringify({ insight, records: records.slice(0, 80) }) },
        ],
        true,
      );
      return normalizePlan(extractJson<Partial<BlockagePlan>>(content), insight);
    } catch {
      return mockPlan(insight);
    }
  }
  await delay(300);
  return mockPlan(insight);
}

export async function buildWeeklyFollowupReply(plan: BlockagePlan, score: number, notes: string): Promise<string> {
  if (score <= 4) {
    return "La intensidad bajó de forma clara. Podemos considerar este bloqueo como más manejable y, si se mantiene así, avanzar al siguiente patrón prioritario.";
  }

  if (isConversandoAiConfigured()) {
    try {
      return await chatCompletion([
        { role: "system", content: followupSystemPrompt() },
        { role: "user", content: JSON.stringify({ plan, score, notes }) },
      ]);
    } catch {
      return mockFollowup(score);
    }
  }
  await delay(250);
  return mockFollowup(score);
}

async function callRealModelInsight(
  records: EmotionalRecord[],
  days: number,
  existingBlockages: string[],
): Promise<PatternInsight> {
  const content = await chatCompletion(
    [
      { role: "system", content: insightSystemPrompt(days, existingBlockages) },
      { role: "user", content: JSON.stringify(records.slice(0, 120)) },
    ],
    true,
  );
  return extractJson<PatternInsight>(content);
}

function insightSystemPrompt(days: number, existingBlockages: string[]): string {
  const phase = days >= 14 ? "full_analysis" : "first_reading";
  const dedupe =
    existingBlockages.length > 0
      ? `Estos bloqueos YA se están trabajando o ya se resolvieron, NO los repitas en priority_blockages: ${existingBlockages.join("; ")}. Si no aparece ningún patrón nuevo y distinto, devuelve priority_blockages vacío y aclara en message que los hábitos actuales son suficientes para seguir midiendo el progreso. `
      : "";
  return (
    "Eres una guía de autoconocimiento emocional y hábitos. No eres terapeuta, no diagnosticas, " +
    "no usas lenguaje clínico definitivo y no prometes curación. Trabajas en español, breve y práctico. " +
    `Han pasado ${days} días desde el primer registro. La fase obligatoria es ${phase}. ` +
    "Si la fase es first_reading, da solo una hipótesis suave. Si es full_analysis, incluye emociones repetidas, detonantes, sensaciones corporales, conductas automáticas, posibles creencias limitantes y máximo 1 o 2 bloqueos prioritarios. " +
    dedupe +
    "Responde SOLO JSON con estas claves: phase, days_observed, records_count, message, repeated_emotions, frequent_triggers, body_sensations, automatic_behaviors, possible_beliefs, priority_blockages."
  );
}

function guidedConversationSystemPrompt(userName: string): string {
  return (
    `Te llamas Baymax. Conversas con ${userName || "el usuario"} como un amigo amable, cálido y atento. ` +
    "Tu función es acompañar un registro de autoconocimiento emocional y hábitos. No eres terapeuta, no diagnosticas, no das conclusiones médicas y no uses lenguaje clínico definitivo. " +
    "NO bombardees con preguntas. Responde primero a lo que la persona dijo, valida o aclara si está confundida, y luego haz como máximo UNA pregunta breve y natural. " +
    "Tu respuesta debe tener esta intención: 1) reconocer algo concreto que la persona dijo, 2) conectar con el dato emocional que falta, 3) hacer UNA sola pregunta. " +
    "Evita frases huecas o genéricas como 'entiendo que estás pasando por un momento difícil' si no agregas una pregunta concreta después. " +
    "Si la persona dice 'no entiendo', 'de qué hablas', '??' o parece confundida, pausa el registro y explica con palabras simples: estás intentando entender qué ocurrió, qué sintió y cómo reaccionó para guardar el momento. Luego pregunta si quiere contarte qué le hizo sentirse mal. " +
    "Si la persona saluda al inicio, saluda de vuelta y preséntate como Baymax de forma corta. No repitas el saludo si ya saludaste. " +
    "Si la persona dice algo general como 'me siento mal', no lo trates como situación completa; acompaña y pregunta qué pasó o qué lo detonó. " +
    "No ofrezcas soluciones todavía, no digas 'vamos a encontrar soluciones juntos' en esta etapa. Primero registra el momento emocional con calma. " +
    "No repitas una oración que ya dijiste antes. Si ya preguntaste 'qué está sucediendo', tu siguiente pregunta debe avanzar hacia emoción, cuerpo, detonante, pensamiento o impulso. " +
    "Debes completar estas 5 piezas principales: situation (qué está pasando), emotion (qué emoción siente), body_sensation (dónde lo siente en el cuerpo), possible_trigger (qué pasó justo antes o qué lo detonó), behavior_impulse (qué hizo o qué impulso apareció). " +
    "Extrae progresivamente estos campos si aparecen: situation, emotion, intensity 1-10, body_sensation, possible_trigger, automatic_thought, behavior_impulse, life_area. " +
    "life_area debe ser una de: dinero, amor, salud, familia, trabajo, proposito, espiritualidad. Si no está claro, usa null. " +
    "No inventes datos. Si un campo no está claro, déjalo vacío o null. " +
    "Cuando ya tengas situation, emotion, body_sensation, possible_trigger y behavior_impulse, puedes marcar ready_to_analyze=true, aunque falten campos secundarios. " +
    "Responde SOLO un JSON válido con estas claves exactas: assistant_message, extraction, missing_fields, ready_to_analyze. " +
    "assistant_message debe sonar humano, cercano y breve, entre 1 y 4 frases. " +
    "La clave extraction SIEMPRE debe ser un objeto, nunca un array ni texto, con esta forma exacta: " +
    "{\"situation\":\"\",\"emotion\":\"\",\"intensity\":null,\"body_sensation\":\"\",\"possible_trigger\":\"\",\"automatic_thought\":\"\",\"behavior_impulse\":\"\",\"life_area\":null}. " +
    "missing_fields debe contener solo nombres de campos faltantes."
  );
}

function planSystemPrompt(): string {
  return (
    "Crea un plan de transformación para solo 1 bloqueo prioritario. No trabajes todos a la vez. " +
    "No hagas terapia ni diagnóstico. Responde SOLO JSON con: title, description, possible_belief, " +
    "audio_suggestion, daily_habit, affirmation, real_action, followup_question. Todo debe ser concreto y aplicable en 5 a 15 minutos diarios."
  );
}

function followupSystemPrompt(): string {
  return (
    "Eres una guía de hábitos y autoconocimiento. Según el puntaje semanal, responde breve. " +
    "Si no baja la intensidad, mantén el mismo bloqueo y propone una pregunta o hábito alternativo. No diagnostiques."
  );
}

function mockInsight(records: EmotionalRecord[], days: number): PatternInsight {
  const topEmotion = top(records.map((r) => r.emotion)) ?? "tensión";
  const topBody = top(records.map((r) => r.body_sensation)) ?? "el cuerpo";
  const topTrigger = top(records.map((r) => r.possible_trigger ?? r.situation)) ?? "una situación repetida";
  const topBehavior = top(records.map((r) => r.behavior_impulse)) ?? "reaccionar en automático";
  const phase = days >= 14 ? "full_analysis" : "first_reading";

  if (phase === "first_reading") {
    return {
      phase,
      days_observed: days,
      records_count: records.length,
      message: `Empieza a aparecer un posible patrón: cuando ocurre ${topTrigger}, sueles sentir ${topEmotion} en ${topBody} y reaccionas con ${topBehavior}. Vamos a seguir observando para confirmarlo.`,
      repeated_emotions: compactTop(records.map((r) => r.emotion)),
      frequent_triggers: compactTop(records.map((r) => r.possible_trigger ?? r.situation)),
      body_sensations: compactTop(records.map((r) => r.body_sensation)),
      automatic_behaviors: compactTop(records.map((r) => r.behavior_impulse)),
      possible_beliefs: [],
      priority_blockages: [],
    };
  }

  return {
    phase,
    days_observed: days,
    records_count: records.length,
    message: `Detectamos varios patrones, pero para avanzar con claridad vamos a trabajar primero el bloqueo más repetido o el que más afecta tu vida. El patrón principal parece ser ${topEmotion} cuando aparece ${topTrigger}.`,
    repeated_emotions: compactTop(records.map((r) => r.emotion)),
    frequent_triggers: compactTop(records.map((r) => r.possible_trigger ?? r.situation)),
    body_sensations: compactTop(records.map((r) => r.body_sensation)),
    automatic_behaviors: compactTop(records.map((r) => r.behavior_impulse)),
    possible_beliefs: [`Si aparece ${topTrigger}, no voy a poder manejarlo con calma.`],
    priority_blockages: [`${topEmotion} ante ${topTrigger}`],
  };
}

function mockPlan(insight: PatternInsight) {
  const title = insight.priority_blockages[0] ?? "Reacción automática ante momentos de tensión";
  return {
    title,
    description: "Trabajaremos primero el patrón más repetido para no dispersar la energía en demasiados cambios a la vez.",
    possible_belief: insight.possible_beliefs[0] ?? "Necesito resolverlo todo de inmediato para estar bien.",
    audio_suggestion: "Audio breve de respiración consciente y observación corporal, 5 minutos antes de iniciar el día.",
    daily_habit: "Registrar una pausa de 3 minutos: nombrar emoción, ubicarla en el cuerpo y elegir una acción pequeña.",
    affirmation: "Puedo observar lo que siento sin actuar en automático.",
    real_action: "Elegir una conversación, decisión o tarea pequeña que normalmente evitarías y hacer solo el primer paso.",
    followup_question: "¿Qué cambió cuando hiciste una pausa antes de responder?",
  };
}

function mockFollowup(score: number): string {
  if (score >= 7) {
    return "La intensidad sigue alta. Esta semana mantén el mismo bloqueo: reduce el hábito a 3 minutos diarios y observa qué pensamiento aparece justo antes del impulso automático.";
  }
  return "Hay una bajada parcial. Sigue trabajando el mismo bloqueo una semana más, pero agrega una acción real pequeña después de la pausa para consolidar el cambio.";
}

function buildCollectingMessage(records: EmotionalRecord[], last: EmotionalRecord | null): string {
  if (!last) return "Aún estamos recopilando información. Sigue registrando tus momentos importantes.";

  const total = records.length;
  const emotion = last.emotion?.trim() || "una emoción todavía por precisar";
  const trigger = last.possible_trigger?.trim() || last.situation?.trim() || "una situación que todavía estás observando";
  const body = last.body_sensation?.trim() || "una zona del cuerpo por precisar";
  const impulse = last.behavior_impulse?.trim() || "una reacción por precisar";
  const area = labelLifeArea(last.life_area);

  return (
    `Ya tengo ${total} registro${total === 1 ? "" : "s"} guardado${total === 1 ? "" : "s"}. ` +
    `De momento quedó anotado ${emotion} en ${body}${area ? `, relacionado con ${area}` : ""}, ` +
    `desencadenado por ${trigger} y con respuesta de ${impulse}. ` +
    "Todavía no saco conclusiones; sigo acumulando información para detectar patrones."
  );
}

function normalizeGuidedTurn(
  value: Partial<GuidedConversationTurn>,
  previous: EmotionalExtraction,
  messages: EmotionalChatMessage[],
): GuidedConversationTurn {
  const extraction = normalizeExtraction(value.extraction, previous);
  const missing = missingFields(extraction);
  const modelMessage =
    typeof value.assistant_message === "string" && value.assistant_message.trim()
      ? value.assistant_message.trim()
      : "";
  const assistant_message =
    modelMessage &&
    !wasRecentlySaid(modelMessage, messages) &&
    !isHollowAssistantMessage(modelMessage) &&
    advancesConversation(modelMessage, missing)
      ? modelMessage
      : questionForMissing(missing[0], extraction);

  return {
    assistant_message,
    extraction,
    missing_fields: missing,
    ready_to_analyze: Boolean(value.ready_to_analyze) && hasMinimumForAnalysis(extraction),
  };
}

function normalizeExtraction(
  value: Partial<EmotionalExtraction> | undefined,
  previous: EmotionalExtraction,
): EmotionalExtraction {
  return {
    situation: nonEmpty(value?.situation) ?? previous.situation,
    emotion: nonEmpty(value?.emotion) ?? previous.emotion,
    intensity: normalizeIntensity(value?.intensity) ?? previous.intensity,
    body_sensation: nonEmpty(value?.body_sensation) ?? previous.body_sensation,
    possible_trigger: nonEmpty(value?.possible_trigger) ?? previous.possible_trigger,
    automatic_thought: nonEmpty(value?.automatic_thought) ?? previous.automatic_thought,
    behavior_impulse: nonEmpty(value?.behavior_impulse) ?? previous.behavior_impulse,
    life_area: normalizeLifeArea(value?.life_area) ?? previous.life_area,
  };
}

function mockGuidedTurn(
  messages: EmotionalChatMessage[],
  extraction: EmotionalExtraction,
): GuidedConversationTurn {
  const last = messages[messages.length - 1]?.content.toLowerCase() ?? "";
  const next = { ...extraction };

  if (last.includes("no entiendo") || last.includes("de que") || last.includes("de qué") || last.includes("??")) {
    return {
      assistant_message:
        "Perdón, fui muy rápido. Soy Baymax y solo quiero ayudarte a ordenar este momento: qué pasó, qué sentiste y qué impulso apareció, para dejarlo registrado sin sacar conclusiones todavía. ¿Qué fue lo que te hizo sentir mal hoy?",
      extraction: next,
      missing_fields: missingFields(next),
      ready_to_analyze: false,
    };
  }

  if (!next.situation && last) next.situation = messages[messages.length - 1]?.content ?? "";
  else if (!next.emotion && last) next.emotion = messages[messages.length - 1]?.content ?? "";
  else if (!next.body_sensation && last) next.body_sensation = messages[messages.length - 1]?.content ?? "";
  else if (!next.behavior_impulse && last) next.behavior_impulse = messages[messages.length - 1]?.content ?? "";

  const missing = missingFields(next);
  return {
    assistant_message: questionForMissing(missing[0], next),
    extraction: next,
    missing_fields: missing,
    ready_to_analyze: hasMinimumForAnalysis(next),
  };
}

function inferExtractionFromLastExchange(
  messages: EmotionalChatMessage[],
  extraction: EmotionalExtraction,
): EmotionalExtraction {
  const next = { ...extraction };
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUser) return next;

  const lastUserIndex = messages.lastIndexOf(lastUser);
  const previousAssistant = messages
    .slice(0, lastUserIndex)
    .reverse()
    .find((message) => message.role === "assistant");
  const answer = lastUser.content.trim();
  const question = (previousAssistant?.content ?? "").toLowerCase();
  const answerLower = answer.toLowerCase();

  if (!answer || isConfusedReply(answerLower)) return next;

  if (question.includes("preocupa") || question.includes("sucediendo") || question.includes("pasó") || question.includes("pasando")) {
    next.situation = mergeText(next.situation, answer);
    next.life_area = next.life_area ?? inferLifeArea(answerLower);
    next.emotion = next.emotion || inferEmotion(answerLower) || "";
  } else if (question.includes("emoción") || question.includes("sientes")) {
    next.emotion = next.emotion || inferEmotion(answerLower) || answer;
  } else if (question.includes("cuerpo") || question.includes("parte")) {
    next.body_sensation = next.body_sensation || answer;
  } else if (question.includes("justo antes") || question.includes("deton")) {
    next.possible_trigger = next.possible_trigger || answer;
  } else if (question.includes("pensamiento")) {
    next.automatic_thought = next.automatic_thought || answer;
  } else if (question.includes("ganas") || question.includes("impulso") || question.includes("hiciste")) {
    next.behavior_impulse = next.behavior_impulse || answer;
  } else if (question.includes("1 al 10") || question.includes("fuerte") || question.includes("intenso")) {
    next.intensity = next.intensity ?? normalizeIntensity(answer);
  } else if (question.includes("área") || question.includes("area")) {
    next.life_area = next.life_area ?? inferLifeArea(answerLower) ?? normalizeLifeArea(answer);
  }

  if (!next.life_area) next.life_area = inferLifeArea(answerLower);
  if (!next.emotion) next.emotion = inferEmotion(answerLower) || "";
  if (!next.automatic_thought) next.automatic_thought = inferAutomaticThought(answer);
  if (next.intensity == null) next.intensity = normalizeIntensity(answerLower);
  return next;
}

function wasRecentlySaid(message: string, messages: EmotionalChatMessage[]): boolean {
  const normalized = normalizeComparable(message);
  return messages
    .filter((item) => item.role === "assistant")
    .slice(-4)
    .some((item) => normalizeComparable(item.content) === normalized);
}

function isConfusedReply(value: string): boolean {
  return (
    value.includes("no entiendo") ||
    value.includes("de que") ||
    value.includes("de qué") ||
    value.includes("??") ||
    value === "?"
  );
}

function mergeText(current: string, next: string): string {
  if (!current) return next;
  if (normalizeComparable(current).includes(normalizeComparable(next))) return current;
  return `${current} ${next}`;
}

function inferLifeArea(value: string): LifeArea | null {
  if (/(dinero|finanza|financ|ahorr|gasto|deuda|pago|sueldo|econom)/.test(value)) return "dinero";
  if (/(pareja|amor|relaci[oó]n|novi|espos)/.test(value)) return "amor";
  if (/(salud|cuerpo|dolor|enfer|ansiedad|cans)/.test(value)) return "salud";
  if (/(familia|mam[aá]|pap[aá]|hijo|herman)/.test(value)) return "familia";
  if (/(trabajo|jefe|cliente|empresa|laboral)/.test(value)) return "trabajo";
  if (/(prop[oó]sito|sentido|rumbo|meta|futuro)/.test(value)) return "proposito";
  if (/(espiritual|dios|fe|alma|medita)/.test(value)) return "espiritualidad";
  return null;
}

function inferEmotion(value: string): string | null {
  if (/(ansiedad|ansioso|ansiosa|preocupad|nervios|estres|estr[eé]s)/.test(value)) return "ansiedad";
  if (/(triste|pena|dolor|duelo|llorar|deprim)/.test(value)) return "tristeza";
  if (/(rabia|enojo|molest|ira|frustr)/.test(value)) return "rabia";
  if (/(miedo|temor|asust|panico|pánico)/.test(value)) return "miedo";
  if (/(culpa|culpable|vergüenza|verguenza)/.test(value)) return "culpa";
  return null;
}

function inferAutomaticThought(value: string): string {
  const normalized = normalizeComparable(value);
  if (/(no se|no puedo|no encuentro|no tengo forma|no hay manera|como solucionarlo|que hacer)/.test(normalized)) {
    return value;
  }
  return "";
}

function normalizeComparable(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function missingFields(extraction: EmotionalExtraction): Array<keyof EmotionalExtraction> {
  const missing: Array<keyof EmotionalExtraction> = [];
  if (!extraction.situation) missing.push("situation");
  if (!extraction.emotion) missing.push("emotion");
  if (!extraction.body_sensation) missing.push("body_sensation");
  if (!extraction.possible_trigger) missing.push("possible_trigger");
  if (!extraction.behavior_impulse) missing.push("behavior_impulse");
  if (extraction.intensity == null) missing.push("intensity");
  if (!extraction.life_area) missing.push("life_area");
  return missing;
}

function hasMinimumForAnalysis(extraction: EmotionalExtraction): boolean {
  return Boolean(
    extraction.situation &&
      extraction.emotion &&
      extraction.body_sensation &&
      extraction.possible_trigger &&
      extraction.behavior_impulse,
  );
}

function nextRequiredField(extraction: EmotionalExtraction): keyof EmotionalExtraction | null {
  return missingFields(extraction)[0] ?? null;
}

function questionForMissing(
  field: keyof EmotionalExtraction | undefined,
  extraction: EmotionalExtraction,
): string {
  switch (field) {
    case "situation":
      return "Te escucho. ¿Qué pasó hoy o qué está pasando ahora que te hizo sentir así?";
    case "emotion":
      return `Gracias por contármelo${areaPhrase(extraction)}. Si tuvieras que ponerle nombre a lo que sientes ahora, ¿qué emoción sería: ansiedad, tristeza, rabia, miedo, culpa u otra?`;
    case "body_sensation":
      return `${emotionBridge(extraction)} ¿En qué parte del cuerpo lo notas más: pecho, garganta, estómago, cabeza, hombros u otra zona?`;
    case "possible_trigger":
      return triggerQuestion(extraction);
    case "behavior_impulse":
      return "Cuando eso apareció, ¿qué hiciste o qué te dieron ganas de hacer: alejarte, discutir, llorar, quedarte quieto, distraerte o buscar ayuda?";
    case "intensity":
      return "Para ubicarlo mejor, del 1 al 10, ¿qué tan fuerte se siente?";
    case "life_area":
      return "¿Sientes que esto toca más el área de dinero, amor, salud, familia, trabajo, propósito o espiritualidad?";
    default:
      return "Gracias por contármelo. Ya tengo lo principal para analizar esta conversación cuando quieras.";
  }
}

function triggerQuestion(extraction: EmotionalExtraction): string {
  if (mentionsGrief(extraction.situation)) {
    return "Lo siento mucho. Para registrarlo con cuidado: ¿qué momento concreto hizo que esta emoción apareciera con más fuerza hoy?";
  }
  return "Quiero ubicar el detonante sin apurarte: ¿qué pasó justo antes de que esa emoción subiera?";
}

function areaPhrase(extraction: EmotionalExtraction): string {
  if (extraction.life_area === "dinero") return " sobre el dinero";
  if (extraction.life_area === "familia") return " sobre tu familia";
  if (extraction.life_area === "trabajo") return " sobre el trabajo";
  return "";
}

function emotionBridge(extraction: EmotionalExtraction): string {
  if (extraction.emotion) return `Tiene sentido que ${extraction.emotion} se sienta pesado en una situación así.`;
  return "Tiene sentido que esto se sienta pesado.";
}

function advancesConversation(message: string, missing: Array<keyof EmotionalExtraction>): boolean {
  if (missing.length === 0) return true;
  return mentionsField(message, missing[0]);
}

function mentionsField(message: string, field: keyof EmotionalExtraction): boolean {
  const value = normalizeComparable(message);
  switch (field) {
    case "emotion":
      return /(emocion|sientes|ansiedad|tristeza|rabia|miedo|culpa)/.test(value);
    case "body_sensation":
      return /(cuerpo|pecho|garganta|estomago|cabeza|hombros|sientes fisicamente)/.test(value);
    case "possible_trigger":
      return /(antes|detono|detonante|aparecio|subio|provoco)/.test(value);
    case "behavior_impulse":
      return /(hiciste|impulso|ganas|reaccion|alejarte|llorar|discutir)/.test(value);
    case "intensity":
      return /(1 al 10|intens|fuerte)/.test(value);
    case "life_area":
      return /(area|dinero|familia|trabajo|amor|salud|proposito|espiritualidad)/.test(value);
    default:
      return /(que paso|pasando|sucede|preocupa)/.test(value);
  }
}

function isHollowAssistantMessage(message: string): boolean {
  const normalized = normalizeComparable(message);
  const hollowStarts = [
    "entiendo que estas pasando por un momento dificil",
    "parece que estas pasando por un momento",
    "quiero estar aqui para escucharte",
    "estamos aqui para hablar",
    "me alegra que hayas compartido",
  ];
  const isGeneric = hollowStarts.some((prefix) => normalized.includes(prefix));
  return isGeneric && !/[¿?]/.test(message);
}

function mentionsGrief(value: string): boolean {
  return /(falleci|murio|murió|muerte|duelo|perdi|perdí|velorio|funeral)/i.test(value);
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeIntensity(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function normalizeLifeArea(value: unknown): LifeArea | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const allowed: LifeArea[] = ["dinero", "amor", "salud", "familia", "trabajo", "proposito", "espiritualidad"];
  return allowed.find((area) => area === normalized) ?? null;
}

function labelLifeArea(area: LifeArea): string {
  switch (area) {
    case "dinero":
      return "dinero";
    case "amor":
      return "amor";
    case "salud":
      return "salud";
    case "familia":
      return "familia";
    case "trabajo":
      return "trabajo";
    case "proposito":
      return "propósito";
    case "espiritualidad":
      return "espiritualidad";
    default:
      return "";
  }
}

function normalizeInsight(value: Partial<PatternInsight>): PatternInsight {
  return {
    phase: value.phase === "full_analysis" || value.phase === "transformation" ? value.phase : value.phase === "first_reading" ? "first_reading" : "collecting",
    days_observed: Number(value.days_observed) || 0,
    records_count: Number(value.records_count) || 0,
    message: String(value.message ?? "Aún estamos observando patrones sin sacar conclusiones definitivas."),
    repeated_emotions: asStringArray(value.repeated_emotions),
    frequent_triggers: asStringArray(value.frequent_triggers),
    body_sensations: asStringArray(value.body_sensations),
    automatic_behaviors: asStringArray(value.automatic_behaviors),
    possible_beliefs: asStringArray(value.possible_beliefs),
    priority_blockages: asStringArray(value.priority_blockages).slice(0, 2),
  };
}

function normalizePlan(value: Partial<BlockagePlan>, insight: PatternInsight) {
  const fallback = mockPlan(insight);
  return {
    title: String(value.title ?? fallback.title),
    description: value.description ? String(value.description) : fallback.description,
    possible_belief: value.possible_belief ? String(value.possible_belief) : fallback.possible_belief,
    audio_suggestion: String(value.audio_suggestion ?? fallback.audio_suggestion),
    daily_habit: String(value.daily_habit ?? fallback.daily_habit),
    affirmation: String(value.affirmation ?? fallback.affirmation),
    real_action: String(value.real_action ?? fallback.real_action),
    followup_question: String(value.followup_question ?? fallback.followup_question),
  };
}

function compactTop(values: string[]): string[] {
  return [...countValues(values).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([value]) => value);
}

function top(values: string[]): string | null {
  return compactTop(values)[0] ?? null;
}

function countValues(values: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
