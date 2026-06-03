import { SetupNotice } from "@/components/SetupNotice";
import { GymTabs } from "@/components/gym/GymTabs";
import { ExerciseCatalog } from "@/components/gym/ExerciseCatalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { listExercisesForUser } from "@/lib/queries/gym";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const session = await requireUser();
  const exercises = await listExercisesForUser(session.userId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <GymTabs />
      <PageHeader
        title="Catálogo de ejercicios"
        subtitle="Globales y tus ejercicios personalizados"
      />
      <ExerciseCatalog exercises={exercises} userId={session.userId} />
    </div>
  );
}
