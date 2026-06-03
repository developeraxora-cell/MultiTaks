import { SetupNotice } from "@/components/SetupNotice";
import { ConversandoDashboard } from "@/components/conversando-ia/ConversandoDashboard";
import { requireUser } from "@/lib/auth/server";
import { buildPatternInsight } from "@/lib/conversando-ia/ai";
import type { BlockageProgress } from "@/lib/conversando-ia/types";
import {
  getBlockagePlans,
  getBlockageProgress,
  getEmotionalConversations,
  getEmotionalRecords,
  getIncludedHabitTitles,
} from "@/lib/queries/conversando-ia";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Las server actions del chat llaman a OpenAI; damos margen para el cold start.
export const maxDuration = 30;

export default async function ConversandoIaPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const records = await getEmotionalRecords(session.userId, 120);
  const plans = await getBlockagePlans(session.userId);

  const lockedTitles = plans
    .filter((p) => p.status === "active" || p.status === "completed")
    .map((p) => p.title);

  const [insight, conversations, includedHabitTitles] = await Promise.all([
    buildPatternInsight(records, lockedTitles),
    getEmotionalConversations(session.userId),
    getIncludedHabitTitles(session.userId),
  ]);

  const activePlans = plans.filter((p) => p.status === "active");
  const progressEntries = await Promise.all(
    activePlans.map(async (plan) => [plan.id, await getBlockageProgress(plan)] as const),
  );
  const progressByPlan: Record<string, BlockageProgress> = Object.fromEntries(progressEntries);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <ConversandoDashboard
        conversations={conversations}
        initialInsight={insight}
        plans={plans}
        progressByPlan={progressByPlan}
        userName={session.name}
        includedHabitTitles={includedHabitTitles}
      />
    </div>
  );
}
