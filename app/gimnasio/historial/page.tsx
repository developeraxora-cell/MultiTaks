import { SetupNotice } from "@/components/SetupNotice";
import { GymTabs } from "@/components/gym/GymTabs";
import { HistoryList } from "@/components/gym/HistoryList";
import { PageHeader } from "@/components/ui/PageHeader";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import {
  countExercisesPerSession,
  getAnalysisSummaries,
  listSessions,
} from "@/lib/queries/gym";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const session = await requireUser();
  const sessions = await listSessions(session.userId);
  const ids = sessions.map((s) => s.id);
  const [counts, summaries] = await Promise.all([
    countExercisesPerSession(ids),
    getAnalysisSummaries(ids),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <GymTabs />
      <PageHeader title="Historial" subtitle="Tus entrenamientos realizados" />
      <HistoryList sessions={sessions} exerciseCounts={counts} aiSummaries={summaries} />
    </div>
  );
}
